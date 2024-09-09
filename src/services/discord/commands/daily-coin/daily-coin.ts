import { SlashCommandBuilder } from '@discordjs/builders';
import { TransactionType } from '../../../../database/models/transactions.model';
import {
    createDailyCoin,
    findLatestUserDailyCoin,
    updateDailyCoin,
} from '../../../../database/queries/dailyCoin.query';
import { makeTransaction } from '../../../transaction.service';
import { Balance } from '../../../../database/models/balance.model';

export const dailyCoin = {
    accountRequired: true,
    data: new SlashCommandBuilder().setName('daily-coin').setDescription('Kogu oma muumitopsist tänased mündid'),
    execute: async (interaction, balance: Balance) => {
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
