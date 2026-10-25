import { expect } from 'chai';
import nock from 'nock';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { placeBet } from '../../../src/services/discord/commands/place-bet/place-bet.ts';
import { gameSelected } from '../../../src/services/discord/interactions/betting/gameSelected.ts';
import { Interaction } from '../../../src/services/interaction.service.ts';
import { RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import { getTestInteraction } from '../../test-data.ts';
import { bettingFixture, mockLiveGame } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

describe('Discord command - place-bet game selection', () => {
    it('Explains when there are no available games without creating a draft', async () => {
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('pole ühtegi mängu');
        expect(await testDb('bets')).to.have.length(0);
    });

    it('Opens the amount menu directly for one game and replaces its previous draft', async () => {
        const fixture = await bettingFixture();
        mockLiveGame(fixture);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        const [draft] = await testDb('bets');
        expect(draft.id).not.to.eq(fixture.bet.id);
        const menu = reply.firstCall.args[0].components[0].toJSON().components[0];
        expect(menu.custom_id).to.eq(`AMOUNT_SELECTED:${fixture.game.id}:${draft.id}`);
        expect(menu.options.map((option: any) => option.value)).to.deep.eq(['10', '20', '50', '100', 'custom']);
        expect(reply.firstCall.args[0].content).to.include('Player-first#').and.include('[EUN1]');
    });

    it('Uses creation time and initial odds when Riot reports a zero start time', async () => {
        const fixture = await bettingFixture();
        mockLiveGame(fixture, { startTime: 0 });
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('Koefitsent: **2**');
        expect((await testDb('bets').first())?.odds).to.eq(2);
    });

    it('Creates a new bettors account before opening the amount menu', async () => {
        const fixture = await bettingFixture();
        await testDb('users').del();
        await testDb('balance').del();
        mockLiveGame(fixture);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('Kontoseis: **100**');
        expect(await testDb('users')).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('transactions')).to.have.length(1);
    });

    for (const platformId of ['EUN1', 'EUW1'] as const) {
        it(`Lists separate owners of the same numeric match ID with second region ${platformId}`, async () => {
            const first = await bettingFixture();
            const second = await bettingFixture({ suffix: 'second', platformId });
            mockLiveGame(first);
            mockLiveGame(second);
            const interaction = getTestInteraction();
            const reply = sandbox.spy(interaction, 'editReply');
            await placeBet.execute(interaction);
            const menu = reply.firstCall.args[0].components[0].toJSON().components[0];
            expect(menu.custom_id).to.eq(Interaction.GAME_SELECTED);
            expect(menu.options.map((option: any) => option.value)).to.deep.eq([
                String(first.game.id),
                String(second.game.id),
            ]);
            expect(menu.options[1].label).to.include(`[${platformId}]`).and.include('Player-second');
            expect((await testDb('bets')).map((bet) => bet.id)).to.deep.eq([first.bet.id, second.bet.id]);

            mockLiveGame(second);
            const selection = getTestInteraction({ customId: menu.custom_id, values: [String(second.game.id)] });
            const selectedReply = sandbox.spy(selection, 'editReply');
            await gameSelected(selection);
            const draft = await testDb('bets').where({ steveGameId: second.game.id }).first();
            expect(selectedReply.firstCall.args[0].components[0].toJSON().components[0].custom_id).to.eq(
                `AMOUNT_SELECTED:${second.game.id}:${draft!.id}`,
            );
            expect(await testDb('bets').where({ id: first.bet.id }).first()).not.to.eq(undefined);
        });
    }

    it('Excludes a game already bet on while keeping the other game available', async () => {
        const first = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second' });
        await testDb('bets').where({ id: first.bet.id }).update({ guess: BetResult.WIN });
        mockLiveGame(first);
        mockLiveGame(second);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].components[0].toJSON().components[0].custom_id).to.match(
            new RegExp(`^AMOUNT_SELECTED:${second.game.id}:`),
        );
    });

    it('Excludes games at the 24 minute boundary', async () => {
        const fixture = await bettingFixture({ startTime: Date.now() - 24 * 60000 });
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${fixture.player.puuid}`)
            .reply(200, { gameId: Number(fixture.game.gameId), platformId: 'EUN1', gameStartTime: fixture.startTime });
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].components).to.deep.eq([]);
        expect((await testDb('bets').first())?.id).to.eq(fixture.bet.id);
    });

    it('Says the user already bet when every open game has their bet', async () => {
        const fixture = await bettingFixture();
        await testDb('bets').where({ id: fixture.bet.id }).update({ guess: BetResult.WIN });
        mockLiveGame(fixture);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('juba panuse teinud');
        expect(reply.firstCall.args[0].components).to.deep.eq([]);
        expect(await testDb('bets')).to.have.length(1);
    });

    it('Keeps another player selectable when one Riot request fails', async () => {
        const first = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second' });
        nock(RIOT_PLATFORM_URL.EUN1).get(`/lol/spectator/v5/active-games/by-summoner/${first.player.puuid}`).reply(500);
        mockLiveGame(second);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('Player-second').and.include('võib nimekiri olla puudulik');
    });

    it('Warns that the list may be incomplete above the game picker', async () => {
        const failing = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second' });
        const third = await bettingFixture({ suffix: 'third' });
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${failing.player.puuid}`)
            .reply(500);
        mockLiveGame(second);
        mockLiveGame(third);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        const { content, components } = reply.firstCall.args[0];
        expect(content).to.include('Vali mängija').and.include('võib nimekiri olla puudulik');
        expect(components[0].toJSON().components[0].custom_id).to.eq(Interaction.GAME_SELECTED);
    });

    it('Reports a failed check instead of an empty list when no game could be checked', async () => {
        const failing = await bettingFixture();
        const bet = await bettingFixture({ suffix: 'second' });
        await testDb('bets').where({ id: bet.bet.id }).update({ guess: BetResult.WIN });
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${failing.player.puuid}`)
            .reply(500);
        mockLiveGame(bet);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('kontroll ebaõnnestus');
        expect(reply.firstCall.args[0].components).to.deep.eq([]);
    });

    it('Does not warn about an incomplete list when every check succeeds', async () => {
        const first = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second' });
        mockLiveGame(first);
        mockLiveGame(second);
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'editReply');
        await placeBet.execute(interaction);
        expect(reply.firstCall.args[0].content).not.to.include('puudulik');
    });

    for (const change of ['completed', 'untracked', 'already-bet'] as const) {
        it(`Revalidates a game selection after it becomes ${change}`, async () => {
            const fixture = await bettingFixture();
            if (change === 'completed') {
                await testDb('steve_games')
                    .where({ id: fixture.game.id })
                    .update({ gameStatus: SteveGameStatus.COMPLETED });
            }
            if (change === 'untracked') {
                await testDb('player').where({ id: fixture.player.id }).update({ isTracked: false });
            }
            if (change === 'already-bet') {
                await testDb('bets').where({ id: fixture.bet.id }).update({ guess: BetResult.WIN });
                mockLiveGame(fixture);
            }
            const interaction = getTestInteraction({
                customId: Interaction.GAME_SELECTED,
                values: [String(fixture.game.id)],
            });
            const reply = sandbox.spy(interaction, 'editReply');
            await gameSelected(interaction);
            expect(reply.firstCall.args[0].components).to.deep.eq([]);
            expect((await testDb('bets').first())?.id).to.eq(fixture.bet.id);
        });
    }
});
