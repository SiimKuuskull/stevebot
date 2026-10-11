import { MessageFlags } from 'discord.js';
import { deleteinProgressBetbyGameId } from '../../../../database/queries/bets.query.ts';
import { findInprogressGame } from '../../../../database/queries/steveGames.query.ts';
import { InteractionError } from '../../../../tools/errors.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { updateBetAmount } from '../../../bet.service.ts';
import { displayBettingButtons } from '../../components/betDecision.ts';

export async function amountSelectedCustom(interaction: any) {
    const inprogressGame = await findInprogressGame();
    if (!inprogressGame) {
        await interaction.reply({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const betAmount = interaction.fields.getTextInputValue('customBetInput');
    if (!betAmount) {
        await deleteinProgressBetbyGameId(interaction.user.id, inprogressGame.gameId);
        return;
    }
    if (isNaN(betAmount) || betAmount <= 0) {
        await interaction.reply({
            content:
                'Sisestage ainult number! Ärge kasutage muid sümboleid! Veenduge, et panus on suurem, kui 0 :wink: ',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    try {
        await updateBetAmount(interaction.user.id, inprogressGame.gameId, betAmount);
    } catch (error) {
        log(error, error instanceof InteractionError ? LoggerType.INFO : LoggerType.ERROR);
        const reply = error instanceof InteractionError ? error.message : 'Midagi läks valesti.. :flushed:';
        await interaction.reply({
            content: reply,
            components: [],
            flags: MessageFlags.Ephemeral,
        });
    }
    await displayBettingButtons(interaction, betAmount, inprogressGame);
}
