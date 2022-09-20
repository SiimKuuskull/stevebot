import { sandbox, testDb } from '../init';
import { addPlayer } from '../../../src/database/queries/player.query';
import { getTestFinishedGameTemplate, getTestGameTemplate, getTestTrackedPlayerTemplate } from '../../test-data';
import { announcer } from '../../../src/services/discord/triggers/announcer/announcer';
import { expect } from 'chai';
import { RIOT_API_EUNE_URL, RIOT_API_EU_URL } from '../../../src/services/riot-games/requests';
import nock from 'nock';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import * as Utils from '../../../src/services/discord/utils';

describe('Triggers - announcer', () => {
    const { execute } = announcer;
    it('Should not create a new game if the tracked player is not currently in game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                status: {
                    message: 'Data not found',
                    status_code: 404,
                },
            });
        await execute();
        const games = await testDb('steve_games');
        expect(games.length).to.eq(0);
    });
    it('Should not add duplicate games', async () => {
        const [player, game] = await Promise.all([
            addPlayer(getTestTrackedPlayerTemplate()),
            createSteveGame(getTestGameTemplate()),
        ]);
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
        const games = await testDb('steve_games');
        expect(games.length).to.eq(1);
    });
    it('Should not add a new game if game is finished but riot spectator still returns an active game', async () => {
        const [player, game] = await Promise.all([
            addPlayer(getTestTrackedPlayerTemplate()),
            createSteveGame(getTestFinishedGameTemplate()),
        ]);
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, ['EUN1_31102452000']);
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
            });
        await execute();
        const games = await testDb('steve_games');
        expect(games.length).to.eq(1);
    });
    it('Should add a new game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                gameId: 3218543000,
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
                gameStartTime: Date.now(),
                gameLength: 1230,
            });
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, ['EUN1_211111111']);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        await execute();
        const games = await testDb('steve_games');
        expect(games.length).to.eq(1);
        expect(channelMessageStub.calledOnceWith(`${player.name} läks just uude normal mängu`));
    });
});
