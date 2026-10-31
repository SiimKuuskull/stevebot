import { MessageFlags } from 'discord.js';
import { BetResult } from '../../../../database/models/bet.model.ts';
import { TransactionType } from '../../../../database/models/transactions.model.ts';
import {
    deleteInProgressBet,
    findUserBetDecision,
    placeUserBetDecision,
} from '../../../../database/queries/bets.query.ts';
import { findInprogressGame } from '../../../../database/queries/steveGames.query.ts';
import { Interaction } from '../../../interaction.service.ts';
import { makeTransaction } from '../../../transaction.service.ts';

export async function guessSelected(interaction: any) {
    const inProgressGame = await findInprogressGame();
    if (!inProgressGame) {
        await interaction.reply({
            content: ':sleeping: | Kahjuks Steve mäng sai läbi. Oota järgmist mängu!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const steveGameId = inProgressGame.id;
    const bet = await findUserBetDecision(interaction.user.id, steveGameId);
    const guess = bet?.guess;

    if (!bet) {
        await interaction.reply({
            content: ':thinking_face: | Ei leidnud teie panust. Proovige palun uuesti oma panus sisestada!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const betAmount = bet?.amount;
    if (!betAmount) {
        await deleteInProgressBet(interaction.user.id, steveGameId);
        await interaction.reply({
            content: ':thinking_face: | Ei leidnud teie panust. Proovige palun uuesti oma panus sisestada!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (guess != BetResult.IN_PROGRESS) {
        await interaction.reply({
            content: ':thinking_face: | Olete juba oma panuse teinud. Kasutage */my-bet* , et näha oma tehtud panust.',
            components: [],
            flags: MessageFlags.Ephemeral,
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
            await placeUserBetDecision(interaction.user.id, BetResult.WIN, steveGameId);
            await interaction.update({
                content: `Pakkumine: Steve **võidab!** Panus: **${betAmount}** muumimünti`,
                components: [],
                flags: MessageFlags.Ephemeral,
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
            await placeUserBetDecision(interaction.user.id, BetResult.LOSE, steveGameId);
            await interaction.update({
                content: `Pakkumine: Steve **kaotab!** Panus: **${betAmount}** muumimünti`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (interaction.customId === Interaction.BET_CANCEL) {
            await deleteInProgressBet(interaction.user.id, steveGameId);
            await interaction.update({
                content: `:face_with_raised_eyebrow: | Tühistasite oma panuse. Teie kontolt ei võetud münte.`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
    }
    await deleteInProgressBet(interaction.user.id, steveGameId);
    await interaction.update({
        content: ` :man_with_probing_cane: | Võtsite liiga kaua aega, et oma panust teha, proovige uuesti!`,
        components: [],
        flags: MessageFlags.Ephemeral,
    });
    return;
}
