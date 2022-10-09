import { placeUserBet } from '../../../../database/queries/bets.query';
import { InteractionError } from '../../../../tools/errors';
import { displayBettingButtons } from './amountSelected';

export async function amountSelectedCustom(interaction) {
    if (interaction.fields.getTextInputValue('customBetInput').match(/^\d+$/)) {
        const amount = Number(interaction.fields.getTextInputValue('customBetInput'));
        try {
            await placeUserBet(interaction.user.tag, interaction.user.id, amount);
        } catch (error) {
            const reply = error instanceof InteractionError ? error.message : 'Midagi läks pekki';
            await interaction.reply({
                content: reply,
                components: [],
            });
            return;
        }
        await displayBettingButtons(interaction, amount);
    } else {
        await interaction.reply({
            content: 'Sisestage ainult number! Ärge kasutage muid sümboleid!',
            components: [],
        });
    }
}
