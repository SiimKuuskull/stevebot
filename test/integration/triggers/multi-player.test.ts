import { expect } from 'chai';
import nock from 'nock';
import { sandbox, testDb } from '../init.ts';
import { type Player } from '../../../src/database/models/player.model.ts';
import { type SteveGame, SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { createBet } from '../../../src/database/queries/bets.query.ts';
import { createUserBalance } from '../../../src/database/queries/balance.query.ts';
import { makeTransaction } from '../../../src/services/transaction.service.ts';
import { announcer } from '../../../src/services/discord/triggers/announcer/announcer.ts';
import { finisher } from '../../../src/services/discord/triggers/finisher/finisher.ts';
import { discordMessages } from '../../../src/services/discord/utils.ts';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL, type RiotPlatform } from '../../../src/services/riot-games/requests.ts';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestTrackedPlayerTemplate,
} from '../../test-data.ts';

function mockActive(player: Player, gameId: string, times = 1) {
    return nock(RIOT_PLATFORM_URL[player.platformId])
        .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
        .times(times)
        .reply(200, {
            gameId: Number(gameId),
            platformId: player.platformId,
            gameStartTime: Date.now(),
            gameQueueConfigId: 420,
            participants: [],
        });
}

function mockLatest(player: Player) {
    return nock(RIOT_API_EU_URL)
        .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
        .reply(200, [`${player.platformId}_111`]);
}

function mockOffline(player: Player, times = 1) {
    return nock(RIOT_PLATFORM_URL[player.platformId])
        .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
        .times(times)
        .reply(404, {});
}

function matchBody(game: SteveGame, participants: { puuid: string; win: boolean }[]) {
    return {
        metadata: { matchId: `${game.platformId}_${game.gameId}` },
        info: { gameId: Number(game.gameId), platformId: game.platformId, gameEndTimestamp: Date.now(), participants },
    };
}

function mockMatch(game: SteveGame, participants: { puuid: string; win: boolean }[]) {
    return nock(RIOT_API_EU_URL)
        .get(`/lol/match/v5/matches/${game.platformId}_${game.gameId}`)
        .reply(200, matchBody(game, participants));
}

async function createPlacedBet(game: SteveGame) {
    const bet = await createBet(getTestBetTemplate({ steveGameId: game.id, guess: BetResult.WIN }));
    await makeTransaction({
        userId: bet.userId,
        amount: -bet.amount,
        externalTransactionId: bet.id,
        type: TransactionType.BET_PLACED,
    });
    return bet;
}

describe('Triggers - multiple players', () => {
    beforeEach(() => {
        nock.disableNetConnect();
    });
    afterEach(() => {
        nock.enableNetConnect();
    });

    it('Should discover three tracked players including a shared match and skip inactive players', async () => {
        const first = await addPlayer(getTestTrackedPlayerTemplate());
        const second = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'second', gameName: 'Second' }));
        const third = await addPlayer(
            getTestTrackedPlayerTemplate({ puuid: 'third', gameName: 'Third', platformId: 'EUW1' }),
        );
        await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'inactive', isTracked: false }));
        for (const player of [first, second, third]) {
            mockActive(player, '123');
            mockLatest(player);
        }
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();

        await announcer.execute();

        const games = await testDb('steve_games');
        expect(games.map((game) => game.playerId)).to.have.members([first.id, second.id, third.id]);
        const metas = await testDb('game_meta');
        expect(metas.map((meta) => meta.steveGameId)).to.have.members(games.map((game) => game.id));
        expect(announce.callCount).to.eq(3);
    });

    it('Should continue announcing other players after one Riot request fails', async () => {
        const failed = await addPlayer(getTestTrackedPlayerTemplate());
        const healthy = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'healthy' }));
        nock(RIOT_PLATFORM_URL.EUN1).get(`/lol/spectator/v5/active-games/by-summoner/${failed.puuid}`).reply(503, {});
        mockActive(healthy, '123');
        mockLatest(healthy);
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();

        await announcer.execute();

        const games = await testDb('steve_games');
        expect(games).to.have.length(1);
        expect(games[0].playerId).to.eq(healthy.id);
        expect(announce.calledOnce).to.eq(true);
    });

    it('Should insert metadata and announce once across overlapping discovery polls', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        mockActive(player, '123', 2);
        let arrivals = 0;
        let release!: () => void;
        const bothRequests = new Promise<void>((resolve) => {
            release = resolve;
        });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .twice()
            .reply(async () => {
                if (++arrivals === 2) {
                    release();
                }
                await bothRequests;
                return [200, ['EUN1_111']];
            });
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();

        await Promise.all([announcer.execute(), announcer.execute()]);
        mockActive(player, '123');
        await announcer.execute();

        expect(await testDb('steve_games')).to.have.length(1);
        expect(await testDb('game_meta')).to.have.length(1);
        expect(announce.calledOnce).to.eq(true);
    });

    it('Should roll back discovery when metadata storage fails and succeed on retry', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        await testDb.raw('ALTER TABLE game_meta ADD CONSTRAINT reject_test_meta CHECK (false)');
        mockActive(player, '123');
        mockLatest(player);
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();

        await announcer.execute();

        expect(await testDb('steve_games')).to.have.length(0);
        expect(await testDb('game_meta')).to.have.length(0);
        expect(announce.called).to.eq(false);
        await testDb.raw('ALTER TABLE game_meta DROP CONSTRAINT reject_test_meta');
        mockActive(player, '123');
        mockLatest(player);
        await announcer.execute();

        expect(await testDb('steve_games')).to.have.length(1);
        expect(await testDb('game_meta')).to.have.length(1);
        expect(announce.calledOnce).to.eq(true);
    });

    it('Should skip discovery if tracking is disabled during a Riot request', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        mockActive(player, '123');
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(async () => {
                await testDb('player').where({ id: player.id }).update({ isTracked: false });
                return [200, ['EUN1_111']];
            });
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();

        await announcer.execute();

        expect(await testDb('steve_games')).to.have.length(0);
        expect(await testDb('game_meta')).to.have.length(0);
        expect(announce.called).to.eq(false);
    });

    const scenarios: { name: string; secondWins: boolean; platformId: RiotPlatform }[] = [
        { name: 'opposing teams in a shared match', secondWins: false, platformId: 'EUN1' },
        { name: 'the same team in a shared match', secondWins: true, platformId: 'EUN1' },
        { name: 'equal numeric IDs on different platforms', secondWins: false, platformId: 'EUW1' },
    ];
    for (const scenario of scenarios) {
        it(`Should settle players independently for ${scenario.name}`, async () => {
            const first = await addPlayer(getTestTrackedPlayerTemplate());
            const second = await addPlayer(
                getTestTrackedPlayerTemplate({ puuid: 'second', gameName: 'Second', platformId: scenario.platformId }),
            );
            const a = await createSteveGame(getTestGameTemplate({ playerId: first.id }));
            const b = await createSteveGame(
                getTestGameTemplate({ playerId: second.id, platformId: second.platformId }),
            );
            await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
            await createPlacedBet(a);
            await createPlacedBet(b);
            mockOffline(first);
            mockOffline(second);
            const participants = [
                { puuid: first.puuid, win: true },
                { puuid: second.puuid, win: scenario.secondWins },
            ];
            mockMatch(a, participants);
            if (a.platformId !== b.platformId) {
                mockMatch(b, participants);
            }
            const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();
            const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

            await finisher.execute();
            await finisher.execute();

            const games = await testDb('steve_games').orderBy('id');
            expect(games.map((game) => game.gameStatus)).to.deep.eq([
                SteveGameStatus.COMPLETED,
                SteveGameStatus.COMPLETED,
            ]);
            expect(games.map((game) => game.gameResult)).to.deep.eq([true, scenario.secondWins]);
            expect((await testDb('bets').orderBy('id')).map((bet) => bet.result)).to.deep.eq([
                BetResult.WIN,
                scenario.secondWins ? BetResult.WIN : BetResult.LOSE,
            ]);
            expect((await testDb('balance').first())?.amount).to.eq(scenario.secondWins ? 120 : 100);
            expect(await testDb('transactions').where({ type: TransactionType.BET_WIN })).to.have.length(
                scenario.secondWins ? 2 : 1,
            );
            expect(announce.calledTwice).to.eq(true);
            expect(notify.calledTwice).to.eq(true);
        });
    }

    it('Should settle an inactive owner using the games stored platform after a transfer', async () => {
        const owner = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: owner.id }));
        const other = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'other' }));
        await testDb('player').where({ id: owner.id }).update({ isTracked: false, platformId: 'EUW1' });
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        await createPlacedBet(game);
        mockOffline(owner);
        mockMatch(game, [
            { puuid: owner.puuid, win: true },
            { puuid: other.puuid, win: false },
        ]);
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameResult).to.eq(true);
        expect((await testDb('balance').first())?.amount).to.eq(110);
        expect(announce.firstCall.args[0]).to.contain(`[EUNE] ${owner.gameName}`);
        expect(notify.firstCall.args[0]).to.contain(`[EUNE] ${owner.gameName}`);
    });

    for (const failedStage of ['spectator', 'match']) {
        it(`Should continue other games after a ${failedStage} error and retry on the next poll`, async () => {
            const failed = await addPlayer(getTestTrackedPlayerTemplate());
            const healthy = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'healthy' }));
            const a = await createSteveGame(getTestGameTemplate({ playerId: failed.id, gameId: '123' }));
            const b = await createSteveGame(getTestGameTemplate({ playerId: healthy.id, gameId: '456' }));
            await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
            await createPlacedBet(a);
            await createPlacedBet(b);
            if (failedStage === 'spectator') {
                nock(RIOT_PLATFORM_URL.EUN1)
                    .get(`/lol/spectator/v5/active-games/by-summoner/${failed.puuid}`)
                    .reply(503, {});
            } else {
                mockOffline(failed);
                nock(RIOT_API_EU_URL).get('/lol/match/v5/matches/EUN1_123').reply(503, {});
            }
            mockOffline(healthy);
            mockMatch(b, [{ puuid: healthy.puuid, win: true }]);
            sandbox.stub(discordMessages, 'sendChannelMessage').resolves();
            sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

            await finisher.execute();

            expect((await testDb('steve_games').orderBy('id')).map((game) => game.gameStatus)).to.deep.eq([
                SteveGameStatus.IN_PROGRESS,
                SteveGameStatus.COMPLETED,
            ]);
            mockOffline(failed);
            mockMatch(a, [{ puuid: failed.puuid, win: true }]);
            await finisher.execute();

            expect(await testDb('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS })).to.have.length(0);
            expect((await testDb('balance').first())?.amount).to.eq(120);
        });
    }

    it('Should leave unknown owners unresolved and refund them only after timeout', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());
        const [game] = await testDb('steve_games')
            .insert({ gameId: '123', platformId: 'EUN1', playerId: null, gameStart: 0 })
            .returning('*');
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        await createPlacedBet(game);
        const fetchStub = sandbox.stub(globalThis, 'fetch').rejects(new Error('Unknown owner must not call Riot'));
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();
        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.IN_PROGRESS);
        expect((await testDb('balance').first())?.amount).to.eq(90);
        sandbox.stub(Date, 'now').returns(game.createdAt.getTime() + 60 * 60 * 1000 + 1);
        await finisher.execute();
        await finisher.execute();

        expect(fetchStub.called).to.eq(false);
        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(1);
    });

    it('Should not substitute another participant when the recorded owner is absent from the match', async () => {
        const owner = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: owner.id }));
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const bet = await createPlacedBet(game);
        mockOffline(owner);
        mockMatch(game, [{ puuid: 'another-participant', win: true }]);
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();

        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.IN_PROGRESS);
        expect(await testDb('bets').first()).to.deep.eq(bet);
        expect((await testDb('balance').first())?.amount).to.eq(90);
        expect(announce.called).to.eq(false);
    });

    it('Should pay and announce once when finisher polls overlap', async () => {
        const owner = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: owner.id }));
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        await createPlacedBet(game);
        mockOffline(owner, 2);
        let arrivals = 0;
        let release!: () => void;
        const bothRequests = new Promise<void>((resolve) => {
            release = resolve;
        });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/${game.platformId}_${game.gameId}`)
            .twice()
            .reply(async () => {
                if (++arrivals === 2) {
                    release();
                }
                await bothRequests;
                return [200, matchBody(game, [{ puuid: owner.puuid, win: true }])];
            });
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage').resolves();
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await Promise.all([finisher.execute(), finisher.execute()]);

        expect((await testDb('balance').first())?.amount).to.eq(110);
        expect(await testDb('transactions').where({ type: TransactionType.BET_WIN })).to.have.length(1);
        expect(announce.calledOnce).to.eq(true);
        expect(notify.calledOnce).to.eq(true);
    });

    it('Should still settle bets when the result announcement fails', async () => {
        const owner = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: owner.id }));
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        await createPlacedBet(game);
        mockOffline(owner);
        mockMatch(game, [{ puuid: owner.puuid, win: true }]);
        sandbox.stub(discordMessages, 'sendChannelMessage').rejects(new Error('Channel unavailable'));
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();

        expect((await testDb('balance').first())?.amount).to.eq(110);
        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.COMPLETED);
    });

    it('Should save payouts before waiting for the result announcement', async () => {
        const owner = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: owner.id }));
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        await createPlacedBet(game);
        mockOffline(owner);
        mockMatch(game, [{ puuid: owner.puuid, win: true }]);
        let announceStarted!: () => void;
        let finishAnnouncement!: () => void;
        const announcing = new Promise<void>((resolve) => {
            announceStarted = resolve;
        });
        const announcement = new Promise<void>((resolve) => {
            finishAnnouncement = resolve;
        });
        sandbox.stub(discordMessages, 'sendChannelMessage').callsFake(() => {
            announceStarted();
            return announcement;
        });
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        const finishing = finisher.execute();
        await announcing;
        const balanceBeforeAnnouncement = await testDb('balance').first();
        finishAnnouncement();
        await finishing;

        expect(balanceBeforeAnnouncement?.amount).to.eq(110);
    });
});
