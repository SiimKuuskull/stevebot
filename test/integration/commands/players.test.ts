import { expect } from 'chai';
import { MessageFlags, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import nock from 'nock';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { commands } from '../../../src/services/discord/commands/command.ts';
import { helpCommand } from '../../../src/services/discord/commands/help/help.ts';
import { trackPlayerCommand, untrackPlayerCommand } from '../../../src/services/discord/commands/players/players.ts';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import { getTestInteraction, getTestTrackedPlayerTemplate, TEST_TRACKED_PLAYER } from '../../test-data.ts';
import { bettingFixture } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

function adminInteraction(options: Record<string, string> = {}, overrides: Record<string, unknown> = {}) {
    return getTestInteraction({
        guildId: 'test-guild',
        memberPermissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
        options: { getString: sandbox.stub().callsFake((name: string) => options[name]), getFocused: () => '' },
        reply: sandbox.stub().resolves(),
        deferReply: sandbox.stub().resolves(),
        editReply: sandbox.stub().resolves(),
        respond: sandbox.stub().resolves(),
        ...overrides,
    });
}

describe('Discord commands - player administration', () => {
    beforeEach(() => {
        sandbox.stub(process, 'env').value({ ...process.env, DISCORD_SERVER_GUILD_ID: 'test-guild' });
    });

    it('Should register admin only guild commands and player autocomplete', () => {
        for (const command of [trackPlayerCommand, untrackPlayerCommand]) {
            expect(commands).to.include(command);
            const data = command.data.toJSON();
            expect(data.default_member_permissions).to.eq(PermissionFlagsBits.Administrator.toString());
            expect(data.dm_permission).to.eq(false);
        }
        const options = untrackPlayerCommand.data.toJSON().options!;
        expect(options[0]).to.include({ name: 'player', autocomplete: true, required: true });
    });

    for (const [name, overrides] of [
        ['non administrator', { memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) }],
        ['direct message', { guildId: null, memberPermissions: null }],
        ['different guild', { guildId: 'other-guild' }],
    ] as const) {
        it(`Should deny a ${name} before running either tracking command`, async () => {
            const fetchStub = sandbox.stub(globalThis, 'fetch').rejects(new Error('Unexpected Riot request'));
            const player = await addPlayer(getTestTrackedPlayerTemplate());
            for (const command of [trackPlayerCommand, untrackPlayerCommand]) {
                const interaction = adminInteraction(
                    { player: String(player.id), 'riot-id': 'Name#Tag', region: 'EUN1' },
                    overrides,
                );

                await command.execute(interaction);

                expect(interaction.reply.firstCall.args[0]).to.include({ flags: MessageFlags.Ephemeral });
                expect(interaction.reply.firstCall.args[0].content).to.include('administraator');
                expect(interaction.deferReply.called).to.eq(false);
                expect(interaction.options.getString.called).to.eq(false);
            }
            const autocomplete = adminInteraction({}, overrides);
            await untrackPlayerCommand.autocomplete(autocomplete);
            expect(autocomplete.respond.calledOnceWithExactly([])).to.eq(true);
            expect(fetchStub.called).to.eq(false);
            expect(await testDb('player')).to.deep.eq([player]);
        });
    }

    it('Should privately confirm adding a validated player', async () => {
        nock(RIOT_API_EU_URL)
            .get(`/riot/account/v1/accounts/by-riot-id/${TEST_TRACKED_PLAYER.gameName}/${TEST_TRACKED_PLAYER.tagLine}`)
            .reply(200, TEST_TRACKED_PLAYER);
        nock(RIOT_PLATFORM_URL.EUW1)
            .get(`/lol/summoner/v4/summoners/by-puuid/${TEST_TRACKED_PLAYER.puuid}`)
            .reply(200, { puuid: TEST_TRACKED_PLAYER.puuid });
        const interaction = adminInteraction({
            'riot-id': `${TEST_TRACKED_PLAYER.gameName}#${TEST_TRACKED_PLAYER.tagLine}`,
            region: 'EUW1',
        });

        await trackPlayerCommand.execute(interaction);

        expect(interaction.deferReply.calledOnceWithExactly({ flags: MessageFlags.Ephemeral })).to.eq(true);
        expect(interaction.editReply.firstCall.args[0].content)
            .to.include(`[EUW] ${TEST_TRACKED_PLAYER.gameName}#${TEST_TRACKED_PLAYER.tagLine}`)
            .and.include('lisati');
        expect(interaction.editReply.firstCall.args[0].allowedMentions).to.deep.eq({ parse: [] });
        expect(await testDb('player').first()).to.include({ isTracked: true, platformId: 'EUW1' });
    });

    it('Should show validation and temporary API errors without changing tracking', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const invalid = adminInteraction({ 'riot-id': 'MissingTag', region: 'EUN1' });
        await trackPlayerCommand.execute(invalid);
        expect(invalid.editReply.firstCall.args[0].content).to.include('Riot ID');
        nock(RIOT_API_EU_URL).get('/riot/account/v1/accounts/by-riot-id/Name/Tag').reply(429, {});
        const unavailable = adminInteraction({ 'riot-id': 'Name#Tag', region: 'EUN1' });

        await trackPlayerCommand.execute(unavailable);

        expect(unavailable.editReply.firstCall.args[0].content).to.include('proovi hiljem');
        expect(await testDb('player')).to.deep.eq([player]);
    });

    it('Should autocomplete only active players with names regions and stable IDs', async () => {
        const first = await addPlayer(getTestTrackedPlayerTemplate({ gameName: 'Same Name' }));
        const second = await addPlayer(
            getTestTrackedPlayerTemplate({ puuid: 'second', gameName: 'Same Name', platformId: 'EUW1' }),
        );
        await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'inactive', gameName: 'Same Name', isTracked: false }));
        const interaction = adminInteraction();

        await untrackPlayerCommand.autocomplete(interaction);

        expect(interaction.respond.firstCall.args[0]).to.have.deep.members([
            { name: `[EUNE] Same Name#${first.tagLine}`, value: String(first.id) },
            { name: `[EUW] Same Name#${second.tagLine}`, value: String(second.id) },
        ]);
        interaction.options.getFocused = () => 'euw';
        await untrackPlayerCommand.autocomplete(interaction);
        expect(interaction.respond.secondCall.args[0]).to.deep.eq([
            { name: `[EUW] Same Name#${second.tagLine}`, value: String(second.id) },
        ]);
    });

    it('Should deactivate the selected player while preserving games and bets', async () => {
        const context = await bettingFixture({ amount: 20 });
        const other = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'other' }));
        const interaction = adminInteraction({ player: String(context.player.id) });

        await untrackPlayerCommand.execute(interaction);

        expect(interaction.deferReply.calledOnceWithExactly({ flags: MessageFlags.Ephemeral })).to.eq(true);
        expect(interaction.editReply.firstCall.args[0].content).to.include('peatati').and.include('/track-player');
        expect(await testDb('player').where({ id: context.player.id }).first()).to.include({ isTracked: false });
        expect(await testDb('player').where({ id: other.id }).first()).to.deep.eq(other);
        expect(await testDb('steve_games')).to.deep.eq([context.game]);
        expect(await testDb('bets')).to.deep.eq([context.bet]);
        const stale = adminInteraction({ player: String(context.player.id) });
        await untrackPlayerCommand.execute(stale);
        expect(stale.editReply.firstCall.args[0].content).to.include('praegu ei jälgita');
    });

    it('Should reject typed names or invalid IDs that were not chosen from autocomplete', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        for (const value of ['Name#Tag', '-1', '1.5', '0', '1suffix']) {
            const interaction = adminInteraction({ player: value });
            await untrackPlayerCommand.execute(interaction);
            expect(interaction.editReply.firstCall.args[0].content).to.include('Vali jälgitav mängija');
        }
        expect(await testDb('player')).to.deep.eq([player]);
    });

    it('Should show tracking help only to server administrators', async () => {
        const admin = adminInteraction();
        const member = adminInteraction({}, { memberPermissions: new PermissionsBitField() });
        await helpCommand.execute(admin);
        await helpCommand.execute(member);
        expect(admin.reply.firstCall.args[0].content).to.include('/track-player').and.include('/untrack-player');
        expect(member.reply.firstCall.args[0].content).not.to.include('/track-player');
    });
});
