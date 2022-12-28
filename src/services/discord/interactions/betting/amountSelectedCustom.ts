import { deleteinProgressBetbyGameId, findInProgressGuess } from '../../../../database/queries/bets.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { InteractionError } from '../../../../tools/errors';
import { log, LoggerType } from '../../../../tools/logger';
import { updateBetAmount } from '../../../bet.service';
import { displayBettingButtons } from '../../components/betDecision';

export async function amountSelectedCustom(interaction) {
    const inprogressGame = await findInprogressGame();
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
        const { gameId: gameId } = await findInProgressGuess(interaction.user.id);
        await updateBetAmount(interaction.user.id, gameId, betAmount);
    } catch (error) {
        log(error, error instanceof InteractionError ? LoggerType.INFO : LoggerType.ERROR);
        const reply = error instanceof InteractionError ? error.message : 'Midagi läks valesti.. :flushed:';
        await interaction.reply({
            content: reply,
            components: [],
            ephemeral: true,
        });
    }
    await displayBettingButtons(interaction, betAmount, inprogressGame);
}
