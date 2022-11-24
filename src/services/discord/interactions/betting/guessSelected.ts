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
    const gameId = inProgressGame.gameId;
    const bet = await findUserBetDecision(interaction.user.id, gameId);

    const betAmount = bet?.amount;
    if (!betAmount) {
        await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
        await interaction.reply({
            content: 'Ei leidnud teie panust. Proovige palun uuesti oma panus sisestada! :thinking_face:',
            components: [],
            ephemeral: true,
        });
        return;
    }
    const betCreation = bet.createdAt;
    const betTimer = Date.now() - betCreation.getTime();
    if (betTimer < 60000) {
        await changeUserBalanceHoldLose(interaction.user.id, betAmount);
        if (interaction.customId === Interaction.BET_WIN) {
            await placeUserBetDecision(interaction.user.id, BetResult.WIN);
            await interaction.update({
                content: `Pakkumine: Steve **võidab!** Panus: **${betAmount}** muumimünti`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        if (interaction.customId === Interaction.BET_LOSE) {
            await placeUserBetDecision(interaction.user.id, BetResult.LOSE);
            await interaction.update({
                content: `Pakkumine: Steve **kaotab!** Panus: **${betAmount}** muumimünti`,
                components: [],
                ephemeral: true,
            });
            return;
        }
    }
    await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
    await interaction.update({
        content: `Võtsite liiga kaua aega, et oma panust teha, proovige uuesti! :man_with_probing_cane:`,
        components: [],
        ephemeral: true,
    });
    return;
}
