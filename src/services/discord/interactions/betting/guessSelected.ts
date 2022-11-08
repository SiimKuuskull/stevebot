import { BetResult } from '../../../../database/models/bet.model';
import { changeUserBalanceHoldLose } from '../../../../database/queries/balance.query';
import {
    deleteinProgressBet,
    findUserBetDecision,
    placeUserBetDecision,
} from '../../../../database/queries/bets.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { Interaction } from '../../../interaction.service';

export async function guessSelected(interaction) {
    const inProgressGame = await findInprogressGame();
    if (!inProgressGame) {
        await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
        await interaction.reply({
            content: 'Kahjuks Steve mäng sai läbi. Oota järgmist mängu! :sleeping:',
            components: [],
            ephemeral: true,
        });
        return;
    }
    const betAmount = (await findUserBetDecision(interaction.user.tag))?.amount;
    if (!betAmount) {
        await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
        await interaction.reply({
            content: 'Ei leidnud teie panust. Proovige palun uuesti oma panus sisestada! :thinking_face:',
            components: [],
            ephemeral: true,
        });
        return;
    }
    await changeUserBalanceHoldLose(interaction.user.tag, betAmount);
    if (interaction.customId === Interaction.BET_WIN) {
        await placeUserBetDecision(interaction.user.tag, BetResult.WIN);
        await interaction.update({
            content: 'Steve võidab! Sinu panus: ' + betAmount,
            components: [],
            ephemeral: true,
        });
    }
    if (interaction.customId === Interaction.BET_LOSE) {
        await placeUserBetDecision(interaction.user.tag, BetResult.LOSE);
        await interaction.update({
            content: 'Steve kaotab! Sinu panus: ' + betAmount,
            components: [],
            ephemeral: true,
        });
    }
}
