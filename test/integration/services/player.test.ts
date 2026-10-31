import { expect } from 'chai';
import nock from 'nock';
import { sandbox, testDb } from '../init.ts';
import { getTestGameTemplate, getTestTrackedPlayerTemplate, TEST_TRACKED_PLAYER } from '../../test-data.ts';
import { addPlayer, findTrackedPlayer, setSingleTrackedPlayer } from '../../../src/database/queries/player.query.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { createProGamers } from '../../../src/services/player.service.ts';
import { RIOT_API_EU_URL } from '../../../src/services/riot-games/requests.ts';

describe('Player tracking', () => {
    it('Should preserve the player ID and game platform when the player is updated', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: player.id }));

        const updated = await setSingleTrackedPlayer({ ...player, gameName: 'Renamed', platformId: 'EUW1' });

        expect(updated.id).to.eq(player.id);
        expect(updated.gameName).to.eq('Renamed');
        expect(updated.platformId).to.eq('EUW1');
        expect(await testDb('player')).to.have.length(1);
        expect(await testDb('steve_games').where({ id: game.id }).first()).to.include({
            playerId: player.id,
            platformId: 'EUN1',
        });
    });

    it('Should retain previous players and their games when switching tracking', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: player.id }));

        const otherPlayer = await setSingleTrackedPlayer({
            ...TEST_TRACKED_PLAYER,
            puuid: 'other-player',
            gameName: 'Other',
            platformId: 'EUW1',
        });

        expect(otherPlayer.id).not.to.eq(player.id);
        expect((await findTrackedPlayer())?.id).to.eq(otherPlayer.id);
        expect(await testDb('player').where({ id: player.id }).first()).to.include({ isTracked: false });
        const joined = await testDb('steve_games as g')
            .join('player as p', 'p.id', 'g.playerId')
            .where('g.id', game.id)
            .select('p.puuid', 'p.platformId')
            .first();
        expect(joined).to.deep.eq({ puuid: player.puuid, platformId: 'EUN1' });

        const restored = await setSingleTrackedPlayer(player);
        expect(restored.id).to.eq(player.id);
        expect(await testDb('player')).to.have.length(2);
        expect(await testDb('player').where({ isTracked: true })).to.have.length(1);
    });

    it('Should roll back tracking changes when saving the next player fails', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());

        let failure: unknown;
        try {
            await setSingleTrackedPlayer({
                ...TEST_TRACKED_PLAYER,
                puuid: 'other-player',
                gameName: 'x'.repeat(256),
                platformId: 'EUN1',
            });
        } catch (error) {
            failure = error;
        }

        expect(failure).to.have.property('code', '22001');
        expect((await findTrackedPlayer())?.id).to.eq(player.id);
        expect(await testDb('player')).to.have.length(1);
    });

    it('Should reuse the player record on repeated setup', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: player.gameName,
            TRACKED_PLAYER_TAG: player.tagLine,
            TRACKED_PLAYER_REGION: 'EUW1',
        });
        nock(RIOT_API_EU_URL)
            .get(`/riot/account/v1/accounts/by-riot-id/${player.gameName}/${player.tagLine}`)
            .twice()
            .reply(200, { puuid: player.puuid, gameName: player.gameName, tagLine: player.tagLine });

        await createProGamers();
        await createProGamers();

        expect(await testDb('player')).to.have.length(1);
        expect(await findTrackedPlayer()).to.include({ id: player.id, platformId: 'EUW1' });
    });

    it('Should keep tracking the existing player when the Riot lookup fails', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        sandbox.stub(process, 'env').value({
            ...process.env,
            TRACKED_PLAYER: 'Missing',
            TRACKED_PLAYER_TAG: 'EUNE',
        });
        nock(RIOT_API_EU_URL)
            .get('/riot/account/v1/accounts/by-riot-id/Missing/EUNE')
            .reply(404, { status: { message: 'Data not found', status_code: 404 } });

        await createProGamers();

        expect((await findTrackedPlayer())?.id).to.eq(player.id);
    });
});
