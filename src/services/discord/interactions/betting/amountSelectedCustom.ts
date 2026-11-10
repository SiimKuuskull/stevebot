import { loadBettingDraft, parseBetAmount, selectBetAmount } from '../../../bet.service.ts';
import { Interaction } from '../../../interaction.service.ts';
import { displayBettingButtons } from '../../components/betDecision.ts';
import { readBettingReference, updateBettingInteraction } from './response.ts';

export async function amountSelectedCustom(interaction: any) {
    await updateBettingInteraction(interaction, async () => {
        const reference = readBettingReference(interaction.customId, [Interaction.AMOUNT_SELECTED_CUSTOM]);
        const amount = parseBetAmount(interaction.fields.getTextInputValue('customBetInput'));
        const { bet, context } = await loadBettingDraft(interaction.user.id, reference);
        const updated = await selectBetAmount(interaction.user.id, reference, amount, context);
        await displayBettingButtons(interaction, updated, context, bet.odds !== updated.odds);
    });
}
