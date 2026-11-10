import {
    ActionRowBuilder,
    type ModalActionRowComponentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { InteractionError } from '../../../../tools/errors.ts';
import { EXPIRED_BET_MESSAGE, loadBettingDraft, parseBetAmount, selectBetAmount } from '../../../bet.service.ts';
import { bettingCustomId, Interaction } from '../../../interaction.service.ts';
import { displayBettingButtons } from '../../components/betDecision.ts';
import { readBettingReference, replyBettingError, updateBettingInteraction } from './response.ts';

export async function amountSelected(interaction: any) {
    const value =
        Array.isArray(interaction.values) && interaction.values.length === 1 ? interaction.values[0] : undefined;
    if (value === 'custom') {
        try {
            const reference = readBettingReference(interaction.customId, [Interaction.AMOUNT_SELECTED]);
            const { bet } = await loadBettingDraft(interaction.user.id, reference, false);
            if (bet.amount !== 0) {
                throw new InteractionError(EXPIRED_BET_MESSAGE);
            }
            const input = new TextInputBuilder()
                .setCustomId('customBetInput')
                .setLabel('Sisesta oma panus!')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(6)
                .setMinLength(1)
                .setPlaceholder('Täisarv vahemikus 1–100 000')
                .setRequired(true);
            const modal = new ModalBuilder()
                .setCustomId(bettingCustomId(Interaction.AMOUNT_SELECTED_CUSTOM, reference))
                .setTitle('Panusta enda soovitud kogus muumimünte!')
                .addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
            await interaction.showModal(modal);
        } catch (error) {
            await replyBettingError(interaction, error, false);
        }
        return;
    }
    await updateBettingInteraction(interaction, async () => {
        const reference = readBettingReference(interaction.customId, [Interaction.AMOUNT_SELECTED]);
        const amount = parseBetAmount(value);
        const { bet, context } = await loadBettingDraft(interaction.user.id, reference);
        const updated = await selectBetAmount(interaction.user.id, reference, amount, context);
        await displayBettingButtons(interaction, updated, context, bet.odds !== updated.odds);
    });
}
