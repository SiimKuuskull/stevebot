import { BetResult } from '../../../../database/models/bet.model';
import { TransactionType } from '../../../../database/models/transactions.model';
import {
    deleteinProgressBet,
    findUserBetDecision,
    placeUserBetDecision,
} from '../../../../database/queries/bets.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { Interaction } from '../../../interaction.service';
import { makeTransaction } from '../../../transaction.service';

export async function guessSelected(interaction) {
    const inProgressGame = await findInprogressGame();
    if (!inProgressGame) {
        await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
        await interaction.reply({
            content: ':sleeping: | Kahjuks Steve mäng sai läbi. Oota järgmist mängu!',
            components: [],
            ephemeral: true,
        });
        return;
    }
    const gameId = inProgressGame.gameId;
    const bet = await findUserBetDecision(interaction.user.id, gameId);
    const guess = bet?.guess;

    if (!bet) {
        await interaction.reply({
            content: ':thinking_face: | Ei leidnud teie panust. Proovige palun uuesti oma panus sisestada!',
            components: [],
            ephemeral: true,
        });
        return;
    }
    const betAmount = bet?.amount;
    if (!betAmount) {
        await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
        await interaction.reply({
            content: ':thinking_face: | Ei leidnud teie panust. Proovige palun uuesti oma panus sisestada!',
            components: [],
            ephemeral: true,
        });
        return;
    }
    if (guess != BetResult.IN_PROGRESS) {
        await interaction.reply({
            content: ':thinking_face: | Olete juba oma panuse teinud. Kasutage */my-bet* , et näha oma tehtud panust.',
            components: [],
            ephemeral: true,
        });
        return;
    }
    const betCreation = bet.createdAt;
    const betTimer = Date.now() - betCreation.getTime();
    if (betTimer < 60000) {
        if (interaction.customId === Interaction.BET_WIN) {
            await makeTransaction(
                {
                    amount: -bet.amount,
                    externalTransactionId: bet.id,
                    type: TransactionType.BET_PLACED,
                    userId: interaction.user.id,
                },
                { hasPenaltyChanged: false },
            );
            await placeUserBetDecision(interaction.user.id, BetResult.WIN, inProgressGame?.gameId);
            await interaction.update({
                content: `Pakkumine: Steve **võidab!** Panus: **${betAmount}** muumimünti`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        if (interaction.customId === Interaction.BET_LOSE) {
            await makeTransaction(
                {
                    amount: -bet.amount,
                    externalTransactionId: bet.id,
                    type: TransactionType.BET_PLACED,
                    userId: interaction.user.id,
                },
                { hasPenaltyChanged: false },
            );
            await placeUserBetDecision(interaction.user.id, BetResult.LOSE, inProgressGame?.gameId);
            await interaction.update({
                content: `Pakkumine: Steve **kaotab!** Panus: **${betAmount}** muumimünti`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        if (interaction.customId === Interaction.BET_CANCEL) {
            await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
            await interaction.update({
                content: `:face_with_raised_eyebrow: | Tühistasite oma panuse. Teie kontolt ei võetud münte.`,
                components: [],
                ephemeral: true,
            });
            return;
        }
    }
    await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
    await interaction.update({
        content: ` :man_with_probing_cane: | Võtsite liiga kaua aega, et oma panust teha, proovige uuesti!`,
        components: [],
        ephemeral: true,
    });
    return;
}
