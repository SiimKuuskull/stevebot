import { InteractionError } from '../../../../tools/errors';
import { log, LoggerType } from '../../../../tools/logger';
import { placeUserBet } from '../../../bet.service';
import { displayBettingButtons } from './amountSelected';

export async function amountSelectedCustom(interaction) {
    const betAmount = interaction.fields.getTextInputValue('customBetInput');
    if (isNaN(betAmount)) {
        await interaction.reply({
            content: 'Sisestage ainult number! Ärge kasutage muid sümboleid!',
            components: [],
        });
        return;
    }
    try {
        const bet = await placeUserBet(interaction.user.tag, interaction.user.id, Number(betAmount));
        await displayBettingButtons(interaction, bet.amount);
    } catch (error) {
        log(error, error instanceof InteractionError ? LoggerType.INFO : LoggerType.ERROR);
        const reply = error instanceof InteractionError ? error.message : 'Midagi läks pekki';
        await interaction.reply({
            content: reply,
            components: [],
            ephemeral: true,
        });
    }
}
