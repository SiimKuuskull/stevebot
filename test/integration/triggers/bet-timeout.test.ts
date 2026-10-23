import { expect } from 'chai';
import nock from 'nock';
import { sandbox, testDb } from '../init.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { type SteveGame, SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import { createUserBalance } from '../../../src/database/queries/balance.query.ts';
import {
    createBet,
    deleteIncompleteBets,
    deleteinProgressBet,
    deleteinProgressBetbyGameId,
} from '../../../src/database/queries/bets.query.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { createSteveGame, updateSteveGame, voidGame } from '../../../src/database/queries/steveGames.query.ts';
import { finisher } from '../../../src/services/discord/triggers/finisher/finisher.ts';
import { amountSelected } from '../../../src/services/discord/interactions/betting/amountSelected.ts';
import { discordMessages } from '../../../src/services/discord/utils.ts';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URLS } from '../../../src/services/riot-games/requests.ts';
import { makeTransaction } from '../../../src/services/transaction.service.ts';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
    TEST_DISCORD_USER,
} from '../../test-data.ts';
import { refundBet } from '../../../src/services/refund.service.ts';

const BET_TIMEOUT_MS = 60 * 60 * 1000;

describe('Triggers - bet timeout refunds', () => {
    async function createPlacedBet(game: SteveGame, userId = 'a-user', guess = BetResult.WIN, amount = 25.5) {
        const balance = await createUserBalance(getTestBalanceTemplate({ userId, amount: 100, penalty: 0.3 }));
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId, userId, guess, amount, odds: 2 }));
        await makeTransaction({
            userId,
            amount: -amount,
            type: TransactionType.BET_PLACED,
            externalTransactionId: bet.id,
        });
        return { bet, balance };
    }

    it('Should refund the full stakes for both guesses and discard unconfirmed selections', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - BET_TIMEOUT_MS - 120000 }));
        const first = await createPlacedBet(game);
        const second = await createPlacedBet(game, 'b-user', BetResult.LOSE, 10);
        const draft = await createBet(getTestBetTemplate({ gameId: game.gameId, userId: 'draft-user', amount: 40 }));
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();

        const bets = await testDb('bets').orderBy('userId');
        expect(bets.map((bet) => bet.id)).to.deep.equal([first.bet.id, second.bet.id]);
        expect(bets.map((bet) => bet.result)).to.deep.equal([BetResult.VOID, BetResult.VOID]);
        expect(bets.map((bet) => bet.guess)).to.deep.equal([BetResult.WIN, BetResult.LOSE]);
        expect(await testDb('bets').where({ id: draft.id }).first()).to.eq(undefined);
        expect(await testDb('transactions').where({ userId: draft.userId })).to.have.length(0);
        for (const { bet, balance } of [first, second]) {
            const updated = await testDb('balance').where({ userId: bet.userId }).first();
            expect(updated?.amount).to.eq(balance.amount);
            expect(updated?.penalty).to.eq(balance.penalty);
            const refund = await testDb('transactions')
                .where({ type: TransactionType.BET_REFUND, externalTransactionId: bet.id })
                .first();
            expect(refund?.amount).to.eq(bet.amount);
            expect(refund?.balance).to.eq(balance.amount);
        }
        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect(notify.callCount).to.eq(2);
        expect(notify.firstCall.args[0]).to.include('25.5');
    });

    it('Should void a timed out game with no confirmed bets', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const draft = await createBet(getTestBetTemplate({ gameId: game.gameId, userId: 'draft-user' }));
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect(await testDb('bets').where({ id: draft.id }).first()).to.eq(undefined);
        expect(notify.called).to.eq(false);
    });

    for (const guess of [BetResult.WIN, BetResult.LOSE]) {
        it(`Should preserve a refunded ${guess} bet when an old amount menu is used`, async () => {
            const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
            const { bet } = await createPlacedBet(game, TEST_DISCORD_USER.id, guess);
            const player = await addPlayer(getTestTrackedPlayerTemplate());
            sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
            await finisher.execute();
            nock(RIOT_PLATFORM_URLS.EUN1)
                .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
                .reply(200, { gameId: Number(game.gameId), participants: [] });

            await amountSelected(getTestInteraction({ values: ['10'] }));

            const storedBet = await testDb('bets').where({ id: bet.id }).first();
            expect(storedBet).to.include({ id: bet.id, result: BetResult.VOID, guess, amount: bet.amount });
            expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(1);
        });
    }

    it('Should remove unfinished selections during cleanup while retaining refunded records', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const { bet } = await createPlacedBet(game);
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        await finisher.execute();

        const cleanups = [
            () => deleteinProgressBet(bet.userId, BetResult.IN_PROGRESS),
            () => deleteinProgressBetbyGameId(bet.userId, game.gameId),
            () => deleteIncompleteBets(game.gameId),
        ];
        for (const cleanup of cleanups) {
            const draft = await createBet(getTestBetTemplate({ gameId: game.gameId, userId: bet.userId, amount: 0 }));
            await cleanup();
            expect(await testDb('bets').where({ id: draft.id }).first()).to.eq(undefined);
            expect(await testDb('bets').where({ id: bet.id }).first()).to.include({ result: BetResult.VOID });
        }
    });

    for (const elapsed of [BET_TIMEOUT_MS - 1, BET_TIMEOUT_MS, BET_TIMEOUT_MS + 1]) {
        it(`Should enforce the strict one-hour boundary at ${elapsed} milliseconds`, async () => {
            const game = await createSteveGame(getTestGameTemplate());
            const { bet } = await createPlacedBet(game);
            const player = await addPlayer(getTestTrackedPlayerTemplate());
            sandbox.stub(Date, 'now').returns(game.gameStart + elapsed);
            sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
            if (elapsed <= BET_TIMEOUT_MS) {
                nock(RIOT_PLATFORM_URLS.EUN1)
                    .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
                    .reply(200, { gameId: Number(game.gameId), participants: [] });
            }

            await finisher.execute();

            expect((await testDb('bets').where({ id: bet.id }).first())?.result).to.eq(
                elapsed > BET_TIMEOUT_MS ? BetResult.VOID : BetResult.IN_PROGRESS,
            );
            const refunds = await testDb('transactions').where({ type: TransactionType.BET_REFUND });
            expect(refunds.length).to.eq(elapsed > BET_TIMEOUT_MS ? 1 : 0);
        });
    }

    for (const elapsed of [1000, BET_TIMEOUT_MS + 1]) {
        it(`Should use creation time when game start is unknown after ${elapsed} milliseconds`, async () => {
            const now = Date.now();
            const game = await createSteveGame(
                getTestGameTemplate({ gameStart: 0, createdAt: new Date(now - elapsed) }),
            );
            await createPlacedBet(game);
            sandbox.stub(Date, 'now').returns(now);
            sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

            await finisher.execute();

            expect((await testDb('bets').first())?.result).to.eq(
                elapsed > BET_TIMEOUT_MS ? BetResult.VOID : BetResult.IN_PROGRESS,
            );
        });
    }

    it('Should refund only once across overlapping checks and subsequent retries', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        await createPlacedBet(game);
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await Promise.all([finisher.execute(), finisher.execute()]);
        await finisher.execute();

        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(1);
        expect(notify.calledOnce).to.eq(true);
    });

    it('Should keep successful refunds when another bet fails and void the game on retry', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const { bet } = await createPlacedBet(game);

        const failing = await createBet(
            getTestBetTemplate({ gameId: game.gameId, userId: 'z-missing', guess: BetResult.LOSE }),
        );
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.IN_PROGRESS);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect((await testDb('bets').where({ id: bet.id }).first())?.result).to.eq(BetResult.VOID);
        expect((await testDb('bets').where({ id: failing.id }).first())?.result).to.eq(BetResult.IN_PROGRESS);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(1);
        expect(notify.calledOnce).to.eq(true);

        await createUserBalance(getTestBalanceTemplate({ userId: 'z-missing', amount: 90 }));
        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect((await testDb('balance').orderBy('userId')).map((balance) => balance.amount)).to.deep.equal([100, 100]);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(2);
        expect(notify.calledTwice).to.eq(true);
    });

    it('Should refund every bet when there are more bets than the concurrency limit', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const userIds = Array.from({ length: 12 }, (_, index) => `user-${index}`);
        for (const userId of userIds) {
            await createPlacedBet(game, userId);
        }
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();

        await finisher.execute();

        expect((await testDb('bets')).map((bet) => bet.result)).to.deep.equal(userIds.map(() => BetResult.VOID));
        expect((await testDb('balance')).map((balance) => balance.amount)).to.deep.equal(userIds.map(() => 100));
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(12);
        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect(notify.callCount).to.eq(12);
    });

    it('Should not refund a bet once its game has been resulted', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const { bet } = await createPlacedBet(game);
        await updateSteveGame(game.gameId, { gameStatus: SteveGameStatus.COMPLETED });

        expect(await refundBet(bet)).to.eq(undefined);
        expect((await testDb('bets').where({ id: bet.id }).first())?.result).to.eq(BetResult.IN_PROGRESS);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(0);
    });

    it('Should refund a bet only once when refunded concurrently', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const { bet } = await createPlacedBet(game);

        const results = await Promise.all([refundBet(bet), refundBet(bet)]);

        expect(results.filter(Boolean)).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(1);
    });

    it('Should not void a game that still has unrefunded bets', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        const { bet } = await createPlacedBet(game);
        const draft = await createBet(getTestBetTemplate({ gameId: game.gameId, userId: 'draft-user', amount: 40 }));

        await voidGame(game.gameId);

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.IN_PROGRESS);
        expect((await testDb('bets').where({ id: bet.id }).first())?.result).to.eq(BetResult.IN_PROGRESS);
        expect(await testDb('bets').where({ id: draft.id }).first()).to.not.eq(undefined);
    });

    it('Should retain completed refunds when Discord notifications fail', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 2 * BET_TIMEOUT_MS }));
        await createPlacedBet(game);
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').rejects(new Error('DM unavailable'));

        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);

        await finisher.execute();

        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect((await testDb('bets').first())?.result).to.eq(BetResult.VOID);
        expect(await testDb('transactions').where({ type: TransactionType.BET_REFUND })).to.have.length(1);
    });

    it('Should not settle a published result after another check has refunded the game', async () => {
        const game = await createSteveGame(getTestGameTemplate());
        await createPlacedBet(game);
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const now = sandbox.stub(Date, 'now').returns(game.gameStart + BET_TIMEOUT_MS);
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        const announce = sandbox.stub(discordMessages, 'sendChannelMessage');
        nock(RIOT_PLATFORM_URLS.EUN1).get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`).reply(404, {});
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/EUN1_${game.gameId}`)
            .reply(async () => {
                now.returns(game.gameStart + BET_TIMEOUT_MS + 1);
                await finisher.execute();
                return [
                    200,
                    { info: { participants: [{ puuid: player.puuid, win: true }], gameEndTimeStamp: Date.now() } },
                ];
            });

        await finisher.execute();

        expect((await testDb('steve_games').first())?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect((await testDb('bets').first())?.result).to.eq(BetResult.VOID);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('transactions').where({ type: TransactionType.BET_WIN })).to.have.length(0);
        expect(announce.called).to.eq(false);
    });
});
