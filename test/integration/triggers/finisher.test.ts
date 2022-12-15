import { sandbox, testDb } from '../init';
import { SteveGame, SteveGameStatus } from '../../../src/database/models/steveGame.model';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createBet } from '../../../src/database/queries/bets.query';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { finisher } from '../../../src/services/discord/triggers/finisher/finisher';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestTrackedPlayerTemplate,
    getTestTransactionTemplate,
    TEST_DISCORD_USER,
    TEST_DISCORD_USER_2,
    TEST_DISCORD_USER_3,
    TEST_DISCORD_USER_4,
} from '../../test-data';
import { expect } from 'chai';
import { addPlayer } from '../../../src/database/queries/player.query';
import nock from 'nock';
import { RIOT_API_EUNE_URL, RIOT_API_EU_URL } from '../../../src/services/riot-games/requests';
import { Bet, BetResult } from '../../../src/database/models/bet.model';
import * as Utils from '../../../src/services/discord/utils';
import { createTransaction } from '../../../src/database/queries/transactions.query';
import { Transaction, TransactionType } from '../../../src/database/models/transactions.model';
import { Balance } from '../../../src/database/models/balance.model';

describe('Triggers - finisher', () => {
    const { execute } = finisher;
    it('Should do nothing if there is no in progress game', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStatus: SteveGameStatus.COMPLETED }));
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId }));
        const balance = await createUserBalance({
            userId: TEST_DISCORD_USER.id,
            userName: TEST_DISCORD_USER.tag,
            amount: bet.amount,
        });

        await execute();

        const newBalance = await testDb('balance').first();
        expect(newBalance.amount).to.eq(balance.amount);
    });
    it('Should not do anything if the game is still in progress', async () => {
        const [game, player] = await Promise.all([
            createSteveGame(getTestGameTemplate({ gameStatus: SteveGameStatus.IN_PROGRESS })),
            addPlayer(getTestTrackedPlayerTemplate()),
        ]);
        const balance = await createUserBalance({
            userId: TEST_DISCORD_USER.id,
            userName: TEST_DISCORD_USER.tag,
            amount: 10,
        });
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId }));
        await createTransaction(
            getTestTransactionTemplate({ amount: bet.amount, type: TransactionType.BET_PLACED, userId: bet.userId }),
        );
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                gameId: game.gameId,
                mapId: 11,
                gameMode: 'CLASSIC',
                gameType: 'MATCHED_GAME',
                gameQueueConfigId: 400,
                participants: [],
                observers: { encryptionKey: 'l+tsbj7fKJse17NrtXsmcFFpGNBPpUYn' },
                platformId: 'EUN1',
                bannedChampions: [
                    { championId: 84, teamId: 100, pickTurn: 1 },
                    { championId: 53, teamId: 100, pickTurn: 2 },
                    { championId: 19, teamId: 100, pickTurn: 3 },
                    { championId: 122, teamId: 100, pickTurn: 4 },
                    { championId: 99, teamId: 100, pickTurn: 5 },
                    { championId: 266, teamId: 200, pickTurn: 6 },
                    { championId: -1, teamId: 200, pickTurn: 7 },
                    { championId: 99, teamId: 200, pickTurn: 8 },
                    { championId: 55, teamId: 200, pickTurn: 9 },
                    { championId: 157, teamId: 200, pickTurn: 10 },
                ],
                gameStartTime: game.gameStart,
                gameLength: 1230,
            });

        await execute();

        const [newBalance, games] = await Promise.all([testDb('balance').first(), testDb('steve_games')]);
        expect(newBalance.amount).to.eq(balance.amount);
        expect(games.length).to.eq(1);
        expect(games[0].gameStatus).to.eq(game.gameStatus);
    });
    it('Should update tables( bets, steve_games ) if there is no longer a game in progress', async () => {
        const game = await createSteveGame(
            getTestGameTemplate({ gameStatus: SteveGameStatus.IN_PROGRESS, gameId: '31102452005' }),
        );
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const amount = 290;
        const balance = await createUserBalance({
            userId: TEST_DISCORD_USER.id,
            userName: TEST_DISCORD_USER.tag,
            amount: amount,
        });
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId, guess: BetResult.WIN }));
        await createTransaction(
            getTestTransactionTemplate({
                amount: bet.amount,
                balance: balance.amount,
                type: TransactionType.BET_PLACED,
                userId: bet.userId,
            }),
        );
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                status: {
                    message: 'Data not found',
                    status_code: 404,
                },
            });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, ['EUN1_31102452005']);
        const matchId = 'EUN1_31102452005';
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/${matchId}`)
            .reply(200, {
                metadata: {
                    matchId: 'EUN1_31102452005',
                },
                info: {
                    gameEndTimeStamp: Date.now() - 100,
                    gameId: '31102452005',
                    gameMode: 'CLASSIC',
                    platformId: 'EUN1',
                    participants: [{ puuid: `${player.puuid}`, win: true }],
                    teams: {
                        win: true,
                    },
                },
            });
        await execute();
        expect(channelMessageStub.calledOnce);
        const [finishedGame, updatedBalance, updatedBet, transactions]: [SteveGame[], Balance, Bet[], Transaction[]] =
            await Promise.all([
                testDb('steve_games').where({ gameStatus: SteveGameStatus.COMPLETED }),
                testDb('balance').where({ userId: TEST_DISCORD_USER.id }).first(),
                testDb('bets').where({ result: BetResult.WIN }),
                testDb('transactions').orderBy('createdAt', 'desc'),
            ]);
        expect(finishedGame.length).to.eq(1);
        expect(updatedBet.length).to.eq(1);
        expect(updatedBalance.amount).to.eq(310);
        expect(transactions.length).to.eq(2);
        expect(transactions[0].balance).to.eq(updatedBalance.amount);
    });
    it(`Should change user's balances and send them a direct message when the game ends`, async () => {
        const game = await createSteveGame(
            getTestGameTemplate({ gameStatus: SteveGameStatus.IN_PROGRESS, gameId: '31102452005' }),
        );
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const [user1Balance, user2Balance, user3Balance, user4Balance, user1Bet, user2Bet, user3Bet, user4Bet] =
            await Promise.all([
                createUserBalance({
                    userId: TEST_DISCORD_USER.id,
                    userName: TEST_DISCORD_USER.tag,
                    amount: 200,
                }),
                createUserBalance({
                    userId: TEST_DISCORD_USER_2.id,
                    userName: TEST_DISCORD_USER_2.tag,
                    amount: 200,
                }),
                createUserBalance({
                    userId: TEST_DISCORD_USER_3.id,
                    userName: TEST_DISCORD_USER_3.tag,
                    amount: 200,
                }),
                createUserBalance({
                    userId: TEST_DISCORD_USER_4.id,
                    userName: TEST_DISCORD_USER_4.tag,
                    amount: 200,
                }),
                createBet(
                    getTestBetTemplate({
                        userId: TEST_DISCORD_USER.id,
                        gameId: game.gameId,
                        guess: BetResult.WIN,
                    }),
                ),
                createBet(
                    getTestBetTemplate({
                        userId: TEST_DISCORD_USER_2.id,
                        gameId: game.gameId,
                        guess: BetResult.WIN,
                    }),
                ),
                createBet(
                    getTestBetTemplate({
                        userId: TEST_DISCORD_USER_3.id,
                        gameId: game.gameId,
                        guess: BetResult.LOSE,
                    }),
                ),
                createBet(
                    getTestBetTemplate({
                        userId: TEST_DISCORD_USER_4.id,
                        gameId: game.gameId,
                        guess: BetResult.LOSE,
                    }),
                ),
            ]);
        await Promise.all([
            createTransaction(
                getTestTransactionTemplate({
                    amount: -user1Bet.amount,
                    balance: user1Balance.amount,
                    externalTransactionId: user1Bet.id,
                    type: TransactionType.BET_PLACED,
                    userId: user1Bet.userId,
                }),
            ),
            createTransaction(
                getTestTransactionTemplate({
                    amount: -user2Bet.amount,
                    balance: user2Balance.amount,
                    externalTransactionId: user2Bet.id,
                    type: TransactionType.BET_PLACED,
                    userId: user2Bet.userId,
                }),
            ),
            createTransaction(
                getTestTransactionTemplate({
                    amount: -user3Bet.amount,
                    balance: user3Balance.amount,
                    externalTransactionId: user3Bet.id,
                    type: TransactionType.BET_PLACED,
                    userId: user3Bet.userId,
                }),
            ),
            createTransaction(
                getTestTransactionTemplate({
                    amount: -user4Bet.amount,
                    balance: user4Balance.amount,
                    externalTransactionId: user4Bet.id,
                    type: TransactionType.BET_PLACED,
                    userId: user4Bet.userId,
                }),
            ),
        ]);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        const fakeMessage = sandbox.stub(Utils, 'sendPrivateMessageToGambler');
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                status: {
                    message: 'Data not found',
                    status_code: 404,
                },
            });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, ['EUN1_31102452005']);
        const matchId = 'EUN1_31102452005';
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/${matchId}`)
            .reply(200, {
                metadata: {
                    matchId: 'EUN1_31102452005',
                },
                info: {
                    gameEndTimeStamp: Date.now() - 100,
                    gameId: '31102452005',
                    gameMode: 'CLASSIC',
                    platformId: 'EUN1',
                    participants: [{ puuid: `${player.puuid}`, win: true }],
                    teams: {
                        win: true,
                    },
                },
            });
        await execute();

        expect(channelMessageStub.calledOnce).to.eq(true);
        expect(fakeMessage.called).to.eq(true);
        const finishedGame = await testDb('steve_games').where({ gameStatus: SteveGameStatus.COMPLETED });
        expect(finishedGame.length).to.eq(1);
        const updatedBalance = await testDb('balance').where({ amount: 200 });
        expect(updatedBalance.length).to.eq(2);
        const { rows: updatedWinningBets } = (await testDb.raw(
            `SELECT user_id, COUNT(*) FROM bets WHERE guess = result AND result != 'IN PROGRESS' GROUP BY user_id`,
        )) as { rows: { user_id: string; count: string }[] };
        expect(updatedWinningBets.length).to.eq(2);
        const { rows: updatedLosingBets } = (await testDb.raw(
            `SELECT user_id, COUNT(*) FROM bets WHERE guess != result AND result != 'IN PROGRESS' GROUP BY user_id`,
        )) as { rows: { user_id: string; count: string }[] };
        expect(updatedLosingBets.length).to.eq(2);
        const transactions = await testDb('transactions').whereNot('type', TransactionType.BET_PLACED);
        expect(transactions.length).to.eq(2);
    });
    it('Should reduce penalty if user loses a bet', async () => {
        const game = await createSteveGame(
            getTestGameTemplate({ gameStatus: SteveGameStatus.IN_PROGRESS, gameId: '31102452005' }),
        );
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const balance = await createUserBalance(getTestBalanceTemplate({ penalty: 0.2 }));
        const bet = await createBet(getTestBetTemplate({ guess: BetResult.LOSE, gameId: game.gameId }));
        await createTransaction(
            getTestTransactionTemplate({
                amount: -bet.amount,
                balance: balance.amount,
                type: TransactionType.BET_PLACED,
                userId: bet.userId,
            }),
        );

        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        const fakeMessage = sandbox.stub(Utils, 'sendPrivateMessageToGambler');
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                status: {
                    message: 'Data not found',
                    status_code: 404,
                },
            });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, ['EUN1_31102452005']);
        const matchId = 'EUN1_31102452005';
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/${matchId}`)
            .reply(200, {
                metadata: {
                    matchId: 'EUN1_31102452005',
                },
                info: {
                    gameEndTimeStamp: Date.now() - 100,
                    gameId: '31102452005',
                    gameMode: 'CLASSIC',
                    platformId: 'EUN1',
                    participants: [{ puuid: `${player.puuid}`, win: true }],
                    teams: {
                        win: true,
                    },
                },
            });
        await execute();
        expect(channelMessageStub.calledOnce).to.eq(true);
        expect(fakeMessage.called).to.eq(true);
        const updatedBalance = await testDb('balance').first();
        expect(updatedBalance.penalty).to.eq(0.1);
    });
    it('Should delete any incompleted bets', async () => {
        const game = await createSteveGame(
            getTestGameTemplate({ gameStatus: SteveGameStatus.IN_PROGRESS, gameId: '31102452005' }),
        );
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const amount = 290;
        await createUserBalance({
            userId: TEST_DISCORD_USER.id,
            userName: TEST_DISCORD_USER.tag,
            amount: amount,
        });
        await createBet(getTestBetTemplate({ gameId: game.gameId, guess: BetResult.IN_PROGRESS }));
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                status: {
                    message: 'Data not found',
                    status_code: 404,
                },
            });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, ['EUN1_31102452005']);
        const matchId = 'EUN1_31102452005';
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/${matchId}`)
            .reply(200, {
                metadata: {
                    matchId: 'EUN1_31102452005',
                },
                info: {
                    gameEndTimeStamp: Date.now() - 100,
                    gameId: '31102452005',
                    gameMode: 'CLASSIC',
                    platformId: 'EUN1',
                    participants: [{ puuid: `${player.puuid}`, win: true }],
                    teams: {
                        win: true,
                    },
                },
            });
        await execute();
        expect(channelMessageStub.calledOnce);
        const finishedGame = await testDb('steve_games').where({ gameStatus: SteveGameStatus.COMPLETED });
        const updatedBet = await testDb('bets').where({ guess: BetResult.IN_PROGRESS });
        expect(finishedGame.length).to.eq(1);
        expect(updatedBet.length).to.eq(0);
    });
});
