import { expect } from 'chai';
import { EXPIRED_BET_MESSAGE, startBettingDraft } from '../../../src/services/bet.service.ts';
import { amountSelectedCustom } from '../../../src/services/discord/interactions/betting/amountSelectedCustom.ts';
import { Interaction } from '../../../src/services/interaction.service.ts';
import { getTestInteraction } from '../../test-data.ts';
import { bettingFixture, mockLiveGame } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

describe('Discord interaction - game-bound custom amount', () => {
    it('Rejects invalid custom amounts without changing or charging the draft', async () => {
        const fixture = await bettingFixture();
        for (const value of ['abc', '', 'NaN', 'Infinity', '1e2', '-1', '0', '1.5', '100001']) {
            const interaction = getTestInteraction({
                customId: fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM),
                fields: { getTextInputValue: () => value },
            });
            const reply = sandbox.spy(interaction, 'editReply');
            await amountSelectedCustom(interaction);
            expect(reply.firstCall.args[0].content).to.include('täisarv');
        }
        expect((await testDb('bets').first())?.amount).to.eq(0);
        expect((await testDb('balance').first())?.amount).to.eq(100);
    });

    for (const team of [undefined, 100, 200]) {
        it(`Stores a custom amount and shows team-safe buttons for team ${team ?? 'spectator'}`, async () => {
            const fixture = await bettingFixture({ team, startTime: Date.now() - 10 * 60000 });
            mockLiveGame(fixture);
            const interaction = getTestInteraction({
                customId: fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM),
                fields: { getTextInputValue: () => '2' },
            });
            const reply = sandbox.spy(interaction, 'editReply');
            await amountSelectedCustom(interaction);
            const ids = reply.firstCall.args[0].components[0]
                .toJSON()
                .components.map((button: any) => button.custom_id);
            expect(ids.includes(fixture.customId(Interaction.BET_WIN, 1.6))).to.eq(team !== 200);
            expect(ids.includes(fixture.customId(Interaction.BET_LOSE, 1.6))).to.eq(team !== 100);
            expect(await testDb('bets').first()).to.include({ amount: 2, odds: 1.6 });
            expect(await testDb('transactions')).to.have.length(0);
        });
    }

    it('Accepts the advertised upper limit of 100000 coins', async () => {
        const fixture = await bettingFixture();
        await testDb('balance').update({ amount: 100000 });
        mockLiveGame(fixture);
        await amountSelectedCustom(
            getTestInteraction({
                customId: fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM),
                fields: { getTextInputValue: () => '100000' },
            }),
        );
        expect((await testDb('bets').first())?.amount).to.eq(100000);
    });

    it('Rejects amounts above the current balance', async () => {
        const fixture = await bettingFixture();
        mockLiveGame(fixture);
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM),
            fields: { getTextInputValue: () => '101' },
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelectedCustom(interaction);
        expect(reply.firstCall.args[0].content).to.include('piisavalt');
        expect((await testDb('bets').first())?.amount).to.eq(0);
    });

    it('Rejects a modal belonging to a replaced draft even when another game is active', async () => {
        const fixture = await bettingFixture();
        await bettingFixture({ suffix: 'other' });
        const replacement = await startBettingDraft(fixture.userId, fixture.context);
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM),
            fields: { getTextInputValue: () => '20' },
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelectedCustom(interaction);
        expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
        expect((await testDb('bets').where({ id: replacement.id }).first())?.amount).to.eq(0);
    });

    it('Does not let a stale modal change an amount already shown on confirmation buttons', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        mockLiveGame(fixture);
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM),
            fields: { getTextInputValue: () => '20' },
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelectedCustom(interaction);
        expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
        expect((await testDb('bets').first())?.amount).to.eq(10);
    });
});
