import { expect } from 'chai';
import nock from 'nock';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import { myBet } from '../../../src/services/discord/commands/my-bet/my-bet.ts';
import { placeBet } from '../../../src/services/discord/commands/place-bet/place-bet.ts';
import { interaction as interactionEvent } from '../../../src/services/discord/events/interaction/interaction.ts';
import { gameSelected } from '../../../src/services/discord/interactions/betting/gameSelected.ts';
import { Interaction } from '../../../src/services/interaction.service.ts';
import { RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import { getTestInteraction } from '../../test-data.ts';
import { bettingFixture, mockLiveGame } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

async function runPlaceBet() {
    const interaction = getTestInteraction();
    const reply = sandbox.spy(interaction, 'editReply');
    await placeBet.execute(interaction);
    return reply.firstCall.args[0];
}

async function routeInteraction(overrides: object) {
    const interaction = getTestInteraction({ isCommand: () => false, channel: { name: 'test' }, ...overrides });
    const reply = sandbox.spy(interaction, 'editReply');
    await interactionEvent.execute(interaction, {});
    return reply.lastCall.args[0];
}

async function confirmBetFrom(amountMenu: any, amount: string, action: Interaction.BET_WIN | Interaction.BET_LOSE) {
    const amountControl = amountMenu.components[0].toJSON().components[0];
    const decision = await routeInteraction({ customId: amountControl.custom_id, values: [amount] });
    const button = decision.components[0]
        .toJSON()
        .components.find((candidate: any) => candidate.custom_id.startsWith(`${action}:`));
    return routeInteraction({ customId: button.custom_id });
}

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

    it('Confirms a bet on the player picked from the menu, using the controls each reply returns', async () => {
        await testDb.raw(`SELECT setval(pg_get_serial_sequence('steve_games', 'id'), 100)`);
        const first = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second' });
        await testDb('bets').del();
        mockLiveGame(first, { times: 2 });
        mockLiveGame(second, { times: 5 });

        const command = getTestInteraction();
        const commandReply = sandbox.spy(command, 'editReply');
        await placeBet.execute(command);
        const picker = commandReply.firstCall.args[0].components[0].toJSON().components[0];
        expect(picker.options.map((option: any) => option.label)).to.deep.eq([
            `[EUN1] Player-first#${first.player.tagLine}`,
            `[EUN1] Player-second#${second.player.tagLine}`,
        ]);

        const choice = picker.options.find((option: any) => option.label.includes('Player-second'));
        const amountMenu = await routeInteraction({ customId: picker.custom_id, values: [choice.value] });
        expect(amountMenu.content).to.include('Player-second');
        const amountControl = amountMenu.components[0].toJSON().components[0];

        const decision = await routeInteraction({ customId: amountControl.custom_id, values: ['20'] });
        expect(decision.content).to.include('Player-second').and.include('**20**');
        const winButton = decision.components[0]
            .toJSON()
            .components.find((button: any) => button.custom_id.startsWith(`${Interaction.BET_WIN}:`));

        const confirmation = await routeInteraction({ customId: winButton.custom_id });
        expect(confirmation.content).to.include('Player-second').and.include('võidab').and.include('**20**');
        expect(confirmation.components).to.deep.eq([]);

        const [bet] = await testDb('bets');
        expect(await testDb('bets')).to.have.length(1);
        expect(bet).to.include({
            steveGameId: second.game.id,
            amount: 20,
            guess: BetResult.WIN,
            result: BetResult.IN_PROGRESS,
        });
        expect((await testDb('balance').first())?.amount).to.eq(80);
        const transactions = await testDb('transactions');
        expect(transactions).to.have.length(1);
        expect(transactions[0]).to.include({
            amount: -20,
            externalTransactionId: bet.id,
            type: TransactionType.BET_PLACED,
        });
        const again = getTestInteraction();
        const againReply = sandbox.spy(again, 'editReply');
        await placeBet.execute(again);
        expect(againReply.firstCall.args[0].content).to.include('Player-first');
        expect(againReply.firstCall.args[0].components[0].toJSON().components[0].custom_id).to.match(
            new RegExp(`^${Interaction.AMOUNT_SELECTED}:${first.game.id}:`),
        );
    });

    it('Places separate bets on two ongoing games of different players', async () => {
        await testDb.raw(`SELECT setval(pg_get_serial_sequence('steve_games', 'id'), 100)`);
        const first = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second', platformId: 'EUW1' });
        await testDb('bets').del();
        mockLiveGame(first, { times: 5 });
        mockLiveGame(second, { times: 6 });

        const picker = (await runPlaceBet()).components[0].toJSON().components[0];
        const choice = picker.options.find((option: any) => option.label.includes('Player-second'));
        const secondMenu = await routeInteraction({ customId: picker.custom_id, values: [choice.value] });
        const secondConfirmation = await confirmBetFrom(secondMenu, '20', Interaction.BET_WIN);
        expect(secondConfirmation.content).to.include('Player-second').and.include('võidab').and.include('**20**');

        const firstMenu = await runPlaceBet();
        expect(firstMenu.content).to.include('Player-first');
        const firstConfirmation = await confirmBetFrom(firstMenu, '50', Interaction.BET_LOSE);
        expect(firstConfirmation.content).to.include('Player-first').and.include('kaotab').and.include('**50**');

        const bets = await testDb('bets').orderBy('id');
        expect(
            bets.map(({ steveGameId, amount, guess, result }) => ({ steveGameId, amount, guess, result })),
        ).to.deep.eq([
            { steveGameId: second.game.id, amount: 20, guess: BetResult.WIN, result: BetResult.IN_PROGRESS },
            { steveGameId: first.game.id, amount: 50, guess: BetResult.LOSE, result: BetResult.IN_PROGRESS },
        ]);
        expect((await testDb('balance').first())?.amount).to.eq(30);
        const transactions = await testDb('transactions').orderBy('id');
        expect(
            transactions.map(({ amount, externalTransactionId, type }) => ({ amount, externalTransactionId, type })),
        ).to.deep.eq([
            { amount: -20, externalTransactionId: bets[0].id, type: TransactionType.BET_PLACED },
            { amount: -50, externalTransactionId: bets[1].id, type: TransactionType.BET_PLACED },
        ]);

        const myBets = getTestInteraction();
        const myBetsReply = sandbox.spy(myBets, 'reply');
        await myBet.execute(myBets);
        expect(myBetsReply.firstCall.args[0].content)
            .to.include('(2)')
            .and.include('Player-first')
            .and.include('Player-second');

        expect((await runPlaceBet()).content).to.include('juba panuse teinud');
    });
});
