import { deleteinProgressBetbyGameId } from '../../../../database/queries/bets.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { InteractionError } from '../../../../tools/errors';
import { log, LoggerType } from '../../../../tools/logger';
import { placeUserBet } from '../../../bet.service';
import { displayBettingButtons } from './amountSelected';

export async function amountSelectedCustom(interaction) {
    const betAmount = interaction.fields.getTextInputValue('customBetInput');
    if (!betAmount) {
        const { gameId: gameId } = await findInprogressGame();
        await deleteinProgressBetbyGameId(interaction.user.id, gameId);
        return;
    }
    if (isNaN(betAmount) || betAmount <= 0) {
        await interaction.reply({
            content:
                'Sisestage ainult number! Ärge kasutage muid sümboleid! Veenduge, et panus on suurem, kui 0 :wink: ',
            components: [],
            ephemeral: true,
        });
        return;
    }
    try {
        const bet = await placeUserBet(interaction.user.id, Number(betAmount));
        await displayBettingButtons(interaction, bet.amount);
    } catch (error) {
        log(error, error instanceof InteractionError ? LoggerType.INFO : LoggerType.ERROR);
        const reply = error instanceof InteractionError ? error.message : 'Midagi läks valesti.. :flushed:';
        await interaction.reply({
            content: reply,
            components: [],
            ephemeral: true,
        });
    }
}
