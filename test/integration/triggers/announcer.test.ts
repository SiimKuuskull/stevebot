import { sandbox, testDb } from '../init.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { getTestFinishedGameTemplate, getTestGameTemplate, getTestTrackedPlayerTemplate } from '../../test-data.ts';
import { announcer } from '../../../src/services/discord/triggers/announcer/announcer.ts';
import { expect } from 'chai';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import nock from 'nock';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { discordMessages as Utils } from '../../../src/services/discord/utils.ts';

describe('Triggers - announcer', () => {
    const { execute } = announcer;
    it('Should not create a new game if the tracked player is not currently in game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        nock(RIOT_PLATFORM_URL.EUN1).get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`).reply(404, {
            httpStatus: 404,
            errorCode: 'NOT_FOUND',
            message: "spectator game info isn't found",
            implementationDetails: 'filtered',
        });
        await execute();
        const games = await testDb('steve_games');
        expect(games.length).to.eq(0);
    });
    it('Should not add duplicate games', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: player.id }));
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
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
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestFinishedGameTemplate({ playerId: player.id }));
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, ['EUN1_31102452000']);
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
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
        const apiResponse = {
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
        };
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, apiResponse);
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, ['EUN1_211111111']);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        await execute();
        const [games, gameMetas] = await Promise.all([testDb('steve_games'), testDb('game_meta')]);
        expect(games.length).to.eq(1);
        expect(gameMetas.length).to.eq(1);
        expect(games[0].playerId).to.eq(player.id);
        expect(await testDb('player')).to.have.length(1);
        expect(gameMetas[0].meta).to.deep.equal(apiResponse);
        expect(channelMessageStub.calledOnceWith(`${player.gameName} läks just uude normal mängu`));
    });
    it('Should not track a game in a featured game mode', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, { gameId: 4016118857, gameQueueConfigId: 2400, participants: [], gameStartTime: Date.now() });

        await execute();

        expect(await testDb('steve_games')).to.have.length(0);
        expect(channelMessageStub.called).to.eq(false);
    });
    it('Should add a new game with its platform for an EUW player', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ platformId: 'EUW1' }));
        nock(RIOT_PLATFORM_URL.EUW1).get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`).reply(200, {
            gameId: 7123456789,
            gameQueueConfigId: 420,
            participants: [],
            platformId: 'EUW1',
            gameStartTime: Date.now(),
        });
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, ['EUW1_7123456788']);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');

        await execute();

        const games = await testDb('steve_games');
        expect(games).to.have.length(1);
        expect(games[0].gameId).to.eq('7123456789');
        expect(games[0].playerId).to.eq(player.id);
        expect(games[0].platformId).to.eq('EUW1');
        expect(channelMessageStub.calledOnce).to.eq(true);
        expect(channelMessageStub.firstCall.args[0]).to.contain(`[EUW] **${player.gameName}**`);
    });
    it('Should not announce an EUW game that has already finished', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ platformId: 'EUW1' }));
        nock(RIOT_PLATFORM_URL.EUW1).get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`).reply(200, {
            gameId: 7123456789,
            gameQueueConfigId: 420,
            participants: [],
            platformId: 'EUW1',
            gameStartTime: Date.now(),
        });
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, ['EUW1_7123456789']);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');

        await execute();

        expect(await testDb('steve_games')).to.have.length(0);
        expect(channelMessageStub.called).to.eq(false);
    });

    it('Should create a separate game when another player already owns the same match', async () => {
        const otherPlayer = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'other', isTracked: false }));
        const otherGame = await createSteveGame(getTestGameTemplate({ playerId: otherPlayer.id }));
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, {
                gameId: Number(otherGame.gameId),
                platformId: 'EUN1',
                gameQueueConfigId: 420,
                gameStartTime: Date.now(),
                participants: [],
            });
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, ['EUN1_111']);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');

        await execute();

        const games = await testDb('steve_games').orderBy('id');
        expect(games).to.have.length(2);
        expect(games[0]).to.deep.eq(otherGame);
        expect(games[1]).to.include({ playerId: player.id, platformId: 'EUN1', gameId: otherGame.gameId });
        expect((await testDb('game_meta'))[0].steveGameId).to.eq(games[1].id);
        expect(channelMessageStub.calledOnce).to.eq(true);
    });

    it('Should distinguish a current match from the same numeric ID on another platform', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const previousGame = await createSteveGame(
            getTestFinishedGameTemplate({ playerId: player.id, platformId: 'EUW1' }),
        );
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, {
                gameId: Number(previousGame.gameId),
                platformId: 'EUN1',
                gameQueueConfigId: 420,
                gameStartTime: Date.now(),
                participants: [],
            });
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, [`EUW1_${previousGame.gameId}`]);
        const channelMessageStub = sandbox.stub(Utils, 'sendChannelMessage');

        await execute();

        const games = await testDb('steve_games').orderBy('id');
        expect(games).to.have.length(2);
        expect(games[0]).to.deep.eq(previousGame);
        expect(games[1]).to.include({ playerId: player.id, platformId: 'EUN1', gameId: previousGame.gameId });
        expect(channelMessageStub.calledOnce).to.eq(true);
    });

    it('Should update only the matching game start time when a newer game exists', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStart: 0, createdAt: new Date(Date.now() - 1000) }),
        );
        const unrelatedGame = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameId: '123', gameStart: 0 }),
        );
        const gameStartTime = 1_000_000;
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, {
                gameId: Number(game.gameId),
                platformId: 'EUN1',
                gameQueueConfigId: 420,
                gameStartTime,
                participants: [],
            });

        await execute();

        expect((await testDb('steve_games').where({ id: game.id }).first())?.gameStart).to.eq(gameStartTime);
        expect(await testDb('steve_games').where({ id: unrelatedGame.id }).first()).to.deep.eq(unrelatedGame);
        expect(await testDb('steve_games')).to.have.length(2);
    });
});
