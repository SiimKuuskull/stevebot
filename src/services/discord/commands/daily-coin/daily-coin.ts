import { SlashCommandBuilder } from '@discordjs/builders';
import { TransactionType } from '../../../../database/models/transactions.model';
import { findUserBalance } from '../../../../database/queries/balance.query';
import {
    createDailyCoin,
    findLatestUserDailyCoin,
    updateDailyCoin,
} from '../../../../database/queries/dailyCoin.query';
import { createBettingAccount } from '../../../registration.service';
import { makeTransaction } from '../../../transaction.service';

export const dailyCoin = {
    data: new SlashCommandBuilder().setName('daily-coin').setDescription('Kogu oma muumitopsist tänased mündid'),
    execute: async (interaction) => {
        const balance = await findUserBalance(interaction.user.id);

        if (!balance) {
            const [balance] = await createBettingAccount(interaction.user.id, interaction.user.tag);
            await interaction.reply({
                content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: **${balance.amount}** muumimünti. :wink:`,
                ephemeral: true,
                components: [],
            });
            return;
        }
        const latestDailyCoin = await findLatestUserDailyCoin(interaction.user.id);
        const millisecondsInDay = 86400000;
        const millisecondsFromLastClaim = Date.now() - latestDailyCoin?.createdAt.getTime();
        const isNewClaimAvailable = millisecondsFromLastClaim > millisecondsInDay;

        if (latestDailyCoin && !isNewClaimAvailable) {
            const waitTimeHours = Math.floor((millisecondsInDay - millisecondsFromLastClaim) / 1000 / 60 / 60);
            const waitTimeMinutes = Math.floor(((millisecondsInDay - millisecondsFromLastClaim) / 1000 / 60) % 60);
            await interaction.reply({
                content: `Raputad oma münditopsi, aga ei kõlise. Tule proovi hiljem uuesti!\n
                Pead ootama veel **${waitTimeHours}** tundi ja **${waitTimeMinutes}** minutit :hourglass:`,
                ephemeral: true,
            });
            return;
        }
        const dailyCoin = await createDailyCoin({ userId: balance.userId });
        const transaction = await makeTransaction(
            {
                amount: 10,
                externalTransactionId: dailyCoin.id,
                type: TransactionType.DAILY_COIN,
                userId: balance.userId,
            },
            { hasPenaltyChanged: false },
        );
        await updateDailyCoin(dailyCoin.id, { transactionId: transaction.id });
        await interaction.reply({
            content: `Väike Muum viskas su münditopsi **10** muumimünti. Tule homme tagasi!`,
            ephemeral: true,
        });
    },
};
