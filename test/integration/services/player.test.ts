import { rejects } from 'node:assert/strict';
import { expect } from 'chai';
import nock from 'nock';
import { sandbox, testDb } from '../init.ts';
import { getTestGameTemplate, getTestTrackedPlayerTemplate, TEST_TRACKED_PLAYER } from '../../test-data.ts';
import {
    activatePlayerTracking,
    addPlayer,
    createInitialTrackedPlayer,
    deactivatePlayerTracking,
    findPlayerById,
    findTrackedPlayers,
} from '../../../src/database/queries/player.query.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { createProGamers } from '../../../src/services/player.service.ts';
import { getActiveLeagueGame } from '../../../src/services/game.service.ts';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';

describe('Player tracking', () => {
    it('Should return every tracked player and exclude inactive players', async () => {
        const first = await addPlayer(getTestTrackedPlayerTemplate());
        const second = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'second', platformId: 'EUW1' }));
        const third = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'third' }));
        await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'inactive', isTracked: false }));

        expect(await findTrackedPlayers()).to.have.deep.members([first, second, third]);
    });

    it('Should return an empty tracked list when every player is inactive', async () => {
        expect(await findTrackedPlayers()).to.deep.eq([]);
        await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));

        expect(await findTrackedPlayers()).to.deep.eq([]);
    });

    it('Should find a player by ID even after tracking is disabled', async () => {
        const previous = await addPlayer(getTestTrackedPlayerTemplate());
        const current = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'current' }));
        await deactivatePlayerTracking(previous.id);

        expect(await findPlayerById(previous.id)).to.include({
            id: previous.id,
            puuid: previous.puuid,
            isTracked: false,
        });
        expect(await findPlayerById(current.id)).to.deep.eq(current);
        expect(await findPlayerById(-1)).to.eq(undefined);
    });

    it('Should fetch the supplied players game and platform even when another player is tracked', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());
        const player = await addPlayer(
            getTestTrackedPlayerTemplate({ puuid: 'previous', platformId: 'EUW1', isTracked: false }),
        );
        const game = { gameId: 123, platformId: 'EUW1', gameStartTime: Date.now() };
        nock(RIOT_PLATFORM_URL.EUW1).get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`).reply(200, game);

        expect(await getActiveLeagueGame(player)).to.deep.eq(game);
    });

    it('Should require an explicit player even when a tracked player exists', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());

        // @ts-expect-error Callers must supply a player instead of relying on an implicit database lookup.
        await rejects(getActiveLeagueGame(), /A player is required to fetch an active game/);
    });

    it('Should preserve the player ID and game platform when the player is updated', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: player.id }));

        const { player: updated, status } = (await activatePlayerTracking({
            puuid: player.puuid,
            gameName: 'Renamed',
            tagLine: player.tagLine,
            platformId: 'EUW1',
        }))!;

        expect(status).to.eq('updated');
        expect(updated.id).to.eq(player.id);
        expect(updated.gameName).to.eq('Renamed');
        expect(updated.platformId).to.eq('EUW1');
        expect(await testDb('player')).to.have.length(1);
        expect(await testDb('steve_games').where({ id: game.id }).first()).to.include({
            playerId: player.id,
            platformId: 'EUN1',
        });
    });

    it('Should seed the configured player once when the player table is empty', async () => {
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: TEST_TRACKED_PLAYER.gameName,
            TRACKED_PLAYER_TAG: TEST_TRACKED_PLAYER.tagLine,
            TRACKED_PLAYER_REGION: 'euw1',
        });
        const fetchSpy = sandbox.spy(globalThis, 'fetch');
        nock(RIOT_API_EU_URL)
            .get(`/riot/account/v1/accounts/by-riot-id/${TEST_TRACKED_PLAYER.gameName}/${TEST_TRACKED_PLAYER.tagLine}`)
            .reply(200, TEST_TRACKED_PLAYER);

        await createProGamers();
        const players = await testDb('player');
        await createProGamers();

        expect(players).to.have.length(1);
        expect(players[0]).to.include({ ...TEST_TRACKED_PLAYER, platformId: 'EUW1', isTracked: true });
        expect(await testDb('player')).to.deep.eq(players);
        expect(fetchSpy.calledOnce).to.eq(true);
    });

    it('Should preserve existing players and games when startup configuration changes', async () => {
        const first = await addPlayer(getTestTrackedPlayerTemplate());
        const second = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'second', platformId: 'EUW1' }));
        const third = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'third' }));
        const inactive = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'inactive', isTracked: false }));
        const game = await createSteveGame(getTestGameTemplate({ playerId: first.id }));
        const fetchStub = sandbox.stub(globalThis, 'fetch').rejects(new Error('Riot is unavailable'));
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: 'Different',
            TRACKED_PLAYER_TAG: 'Changed',
            TRACKED_PLAYER_REGION: 'EUW1',
        });

        await createProGamers();

        expect(await testDb('player')).to.have.deep.members([first, second, third, inactive]);
        expect(await testDb('steve_games')).to.deep.eq([game]);
        expect(fetchStub.called).to.eq(false);
    });

    it('Should leave every player inactive across repeated startups', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const fetchStub = sandbox.stub(globalThis, 'fetch').rejects(new Error('Riot must not be called'));
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: player.gameName,
            TRACKED_PLAYER_TAG: player.tagLine,
            TRACKED_PLAYER_REGION: 'EUW1',
        });

        await createProGamers();
        await createProGamers();

        expect(await findTrackedPlayers()).to.deep.eq([]);
        expect(await testDb('player')).to.deep.eq([player]);
        expect(fetchStub.called).to.eq(false);
    });

    it('Should leave an empty database intact on lookup failure and retry on the next startup', async () => {
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: 'Missing',
            TRACKED_PLAYER_TAG: 'EUNE',
            TRACKED_PLAYER_REGION: 'EUN1',
        });
        nock(RIOT_API_EU_URL)
            .get('/riot/account/v1/accounts/by-riot-id/Missing/EUNE')
            .reply(404, { status: { message: 'Data not found', status_code: 404 } });

        await createProGamers();

        expect(await testDb('player')).to.have.length(0);
        nock(RIOT_API_EU_URL).get('/riot/account/v1/accounts/by-riot-id/Missing/EUNE').reply(200, TEST_TRACKED_PLAYER);

        await createProGamers();

        const players = await testDb('player');
        expect(players).to.have.length(1);
        expect(players[0]).to.include({ ...TEST_TRACKED_PLAYER, platformId: 'EUN1', isTracked: true });
    });

    it('Should preserve a player inserted while the startup Riot lookup is in flight', async () => {
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: TEST_TRACKED_PLAYER.gameName,
            TRACKED_PLAYER_TAG: TEST_TRACKED_PLAYER.tagLine,
            TRACKED_PLAYER_REGION: 'EUW1',
        });
        let existingPlayers: Awaited<ReturnType<typeof findTrackedPlayers>> = [];
        nock(RIOT_API_EU_URL)
            .get(`/riot/account/v1/accounts/by-riot-id/${TEST_TRACKED_PLAYER.gameName}/${TEST_TRACKED_PLAYER.tagLine}`)
            .reply(async () => {
                existingPlayers = [await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }))];
                return [200, TEST_TRACKED_PLAYER];
            });

        await createProGamers();

        expect(existingPlayers).to.have.length(1);
        expect(await testDb('player')).to.deep.eq(existingPlayers);
        expect(await findTrackedPlayers()).to.deep.eq([]);
    });

    it('Should seed only one player when initial inserts run concurrently', async () => {
        const inserted = await Promise.all([
            createInitialTrackedPlayer({ ...TEST_TRACKED_PLAYER, platformId: 'EUN1' }),
            createInitialTrackedPlayer({ ...TEST_TRACKED_PLAYER, puuid: 'other', platformId: 'EUW1' }),
        ]);

        const created = inserted.filter((player) => player !== undefined);
        expect(created).to.have.length(1);
        expect(await testDb('player')).to.deep.eq(created);
        expect(await findTrackedPlayers()).to.deep.eq(created);
    });
});
