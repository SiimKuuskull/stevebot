import { testDb } from '../init';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createBet } from '../../../src/database/queries/bets.query';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { finisher } from '../../../src/services/discord/triggers/finisher/finisher';
import { getTestBetTemplate, getTestGameTemplate, getTestTrackedPlayerTemplate } from '../../test-data';
import { expect } from 'chai';
import { addPlayer } from '../../../src/database/queries/player.query';
import nock from 'nock';
import { RIOT_API_EUNE_URL } from '../../../src/services/riot-games/requests';

describe('Triggers - finisher', () => {
    const { execute } = finisher;
    it('Should do nothing if there is no in progress game', async () => {
        const game = await createSteveGame(getTestGameTemplate({ gameStatus: SteveGameStatus.COMPLETED }));
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId }));
        const balance = await createUserBalance({ userId: bet.userId, userName: bet.userName, amount: bet.amount });

        await execute();

        const newBalance = await testDb('balance').first();
        expect(newBalance.amount).to.eq(balance.amount);
    });
    it('Should not do anything if the game is still in progress', async () => {
        const [game, player] = await Promise.all([
            createSteveGame(getTestGameTemplate({ gameStatus: SteveGameStatus.IN_PROGRESS })),
            addPlayer(getTestTrackedPlayerTemplate()),
        ]);
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId }));
        const balance = await createUserBalance({ userId: bet.userId, userName: bet.userName, amount: bet.amount });
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
});
