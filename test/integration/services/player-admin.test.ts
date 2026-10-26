import { rejects } from 'node:assert/strict';
import { expect } from 'chai';
import nock from 'nock';
import { activatePlayerTracking, addPlayer, findTrackedPlayers } from '../../../src/database/queries/player.query.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { loadBettingGame } from '../../../src/services/bet.service.ts';
import { trackPlayer, untrackPlayer } from '../../../src/services/player.service.ts';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL, type RiotPlatform } from '../../../src/services/riot-games/requests.ts';
import { InteractionError, RiotRequestError } from '../../../src/tools/errors.ts';
import { getTestTrackedPlayerTemplate, TEST_TRACKED_PLAYER } from '../../test-data.ts';
import { bettingFixture } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

function mockAccount(profile = TEST_TRACKED_PLAYER, requestedName = profile.gameName) {
    return nock(RIOT_API_EU_URL)
        .get(
            `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(requestedName)}/${encodeURIComponent(profile.tagLine)}`,
        )
        .reply(200, profile);
}

function mockProfile(profile = TEST_TRACKED_PLAYER, platform: RiotPlatform = 'EUN1') {
    mockAccount(profile);
    nock(RIOT_PLATFORM_URL[platform])
        .get(`/lol/summoner/v4/summoners/by-puuid/${profile.puuid}`)
        .reply(200, { puuid: profile.puuid });
}

async function fillSlots() {
    for (let index = 0; index < 3; index++) {
        await addPlayer(getTestTrackedPlayerTemplate({ puuid: `active-${index}` }));
    }
}

describe('Player tracking administration', () => {
    for (const platform of ['EUN1', 'EUW1'] as const) {
        it(`Should validate and add a player on ${platform}`, async () => {
            mockAccount(TEST_TRACKED_PLAYER, 'Requested Name');
            nock(RIOT_PLATFORM_URL[platform])
                .get(`/lol/summoner/v4/summoners/by-puuid/${TEST_TRACKED_PLAYER.puuid}`)
                .reply(200, { puuid: TEST_TRACKED_PLAYER.puuid });

            const result = await trackPlayer(` Requested Name # ${TEST_TRACKED_PLAYER.tagLine} `, platform);

            expect(result.status).to.eq('added');
            expect(result.player).to.include({ ...TEST_TRACKED_PLAYER, platformId: platform, isTracked: true });
            expect(await findTrackedPlayers()).to.deep.eq([result.player]);
        });
    }

    it('Should stop new bets and preserve pending bets and history through reactivation', async () => {
        const context = await bettingFixture({ amount: 20 });
        await testDb('bets').where({ id: context.bet.id }).update({ guess: BetResult.WIN });
        const originalBet = await testDb('bets').first();
        const originalMeta = await testDb('game_meta').first();
        const fetchSpy = sandbox.spy(globalThis, 'fetch');

        const inactive = await untrackPlayer(context.player.id);

        expect(inactive.isTracked).to.eq(false);
        expect(await findTrackedPlayers()).to.deep.eq([]);
        await rejects(loadBettingGame(context.game.id), InteractionError);
        expect(fetchSpy.called).to.eq(false);
        const profile = { ...context.player, gameName: 'Renamed', tagLine: 'NEW' };
        mockProfile(profile, 'EUW1');

        const restored = await trackPlayer('Renamed#NEW', 'EUW1');

        expect(restored.status).to.eq('reactivated');
        expect(restored.player).to.include({
            id: context.player.id,
            puuid: context.player.puuid,
            isTracked: true,
            gameName: 'Renamed',
            platformId: 'EUW1',
        });
        expect(await testDb('player')).to.have.length(1);
        expect(await testDb('steve_games')).to.deep.eq([context.game]);
        expect(await testDb('bets').first()).to.deep.eq(originalBet);
        expect(await testDb('game_meta').first()).to.deep.eq(originalMeta);
    });

    it('Should refresh an active player at capacity without consuming a slot', async () => {
        await fillSlots();
        const existing = await testDb('player').where({ puuid: 'active-0' }).first();
        const profile = { ...TEST_TRACKED_PLAYER, puuid: existing!.puuid, gameName: 'Renamed' };
        mockProfile(profile, 'EUW1');

        const result = await trackPlayer(`Renamed#${profile.tagLine}`, 'EUW1');

        expect(result.status).to.eq('updated');
        expect(result.player).to.include({ id: existing!.id, gameName: 'Renamed', platformId: 'EUW1' });
        expect(await findTrackedPlayers()).to.have.length(3);
        expect(await testDb('player')).to.have.length(3);
    });

    for (const reactivation of [false, true]) {
        it(`Should reject a ${reactivation ? 'reactivated' : 'fourth new'} player at capacity without changing records`, async () => {
            await fillSlots();
            if (reactivation) {
                await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
            }
            const before = await testDb('player').orderBy('id');
            mockProfile();

            await rejects(
                trackPlayer(`${TEST_TRACKED_PLAYER.gameName}#${TEST_TRACKED_PLAYER.tagLine}`, 'EUN1'),
                /kuni 3/,
            );

            expect(await testDb('player').orderBy('id')).to.deep.eq(before);
        });
    }

    it('Should admit only one concurrent addition when two slots are taken', async () => {
        await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'existing-1' }));
        await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'existing-2' }));
        const profiles = ['candidate-1', 'candidate-2'].map((puuid) => ({
            ...TEST_TRACKED_PLAYER,
            puuid,
            gameName: puuid,
        }));
        for (const profile of profiles) {
            mockProfile(profile);
        }

        const results = await Promise.allSettled(
            profiles.map((profile) => trackPlayer(`${profile.gameName}#${profile.tagLine}`, 'EUN1')),
        );

        expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
        const rejected = results.find((result) => result.status === 'rejected');
        expect(rejected).to.have.property('reason').that.is.instanceOf(InteractionError);
        expect(await findTrackedPlayers()).to.have.length(3);
        expect(await testDb('player')).to.have.length(3);
    });

    it('Should reuse one player record when the same account is added concurrently', async () => {
        const profile = { ...TEST_TRACKED_PLAYER, platformId: 'EUN1' as const };
        const results = await Promise.all([activatePlayerTracking(profile), activatePlayerTracking(profile)]);

        expect(results.map((result) => result!.player.id)).to.deep.eq([results[0]!.player.id, results[0]!.player.id]);
        expect(results.map((result) => result!.status)).to.have.members(['added', 'updated']);
        expect(await findTrackedPlayers()).to.have.length(1);
    });

    it('Should free a slot after deactivation and reject stale removal requests', async () => {
        await fillSlots();
        const [player] = await findTrackedPlayers();
        await untrackPlayer(player.id);
        await rejects(untrackPlayer(player.id), /praegu ei jälgita/);
        await rejects(untrackPlayer(999999), /praegu ei jälgita/);
        mockProfile();

        await trackPlayer(`${TEST_TRACKED_PLAYER.gameName}#${TEST_TRACKED_PLAYER.tagLine}`, 'EUN1');

        expect(await findTrackedPlayers()).to.have.length(3);
        expect(await testDb('player')).to.have.length(4);
        expect(await testDb('player').where({ id: player.id }).first()).to.include({ isTracked: false });
    });

    it('Should reject malformed Riot IDs and unsupported regions before calling Riot', async () => {
        const fetchStub = sandbox.stub(globalThis, 'fetch').rejects(new Error('Unexpected Riot request'));
        for (const riotId of ['', 'Name', '#Tag', 'Name#', 'Name#Tag#Extra']) {
            await rejects(trackPlayer(riotId, 'EUN1'), /Riot ID/);
        }
        await rejects(trackPlayer('Name#Tag', 'NA1'), /EUNE või EUW/);
        expect(fetchStub.called).to.eq(false);
        expect(await testDb('player')).to.have.length(0);
    });

    for (const stage of ['account', 'summoner']) {
        for (const status of [404, 429, 500]) {
            it(`Should preserve tracking after Riot ${stage} lookup returns ${status}`, async () => {
                const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
                if (stage === 'summoner') {
                    mockAccount();
                    nock(RIOT_PLATFORM_URL.EUN1)
                        .get(`/lol/summoner/v4/summoners/by-puuid/${player.puuid}`)
                        .reply(status, {});
                } else {
                    nock(RIOT_API_EU_URL)
                        .get(`/riot/account/v1/accounts/by-riot-id/${player.gameName}/${player.tagLine}`)
                        .reply(status, {});
                }

                await rejects(
                    trackPlayer(`${player.gameName}#${player.tagLine}`, 'EUN1'),
                    status === 404 ? InteractionError : RiotRequestError,
                );

                expect(await testDb('player')).to.deep.eq([player]);
            });
        }
    }
});
