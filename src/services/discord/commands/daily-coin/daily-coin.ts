import { SlashCommandBuilder } from '@discordjs/builders';
import { db } from '../../../../database/db';
import { Balance } from '../../../../database/models/balance.model';
import { createUserBalance, findUserBalance } from '../../../../database/queries/balance.query';
import { log } from '../../../../tools/logger';

export const dailyCoin = {
    data: new SlashCommandBuilder().setName('daily-coin').setDescription('Kogu oma muumitopsist tänased mündid'),
    execute: async (interaction) => {
        let balance = await findUserBalance(interaction.user.id);

        if (!balance) {
            balance = await createUserBalance({ userId: interaction.user.id, userName: interaction.user.tag });
            await interaction.reply({
                content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: ${balance.amount} muumimünti. :wink:`,
                ephemeral: true,
                components: [],
            });
            return;
        }
        if (!balance.dailyCoin) {
            await updateBalance(balance);
            await interaction.reply({
                content: `Väike Muum viskas su münditopsi 10 muumimünti. Tule homme tagasi!`,
                ephemeral: true,
            });
            return;
        }
        const hasDaily = Date.now() - balance.dailyCoin?.getTime();
        if (hasDaily > 86400000) {
            await updateBalance(balance);
            await interaction.reply({
                content: `Väike Muum viskas su münditopsi 10 muumimünti. Tule homme tagasi!`,
                ephemeral: true,
            });
        }
        if (hasDaily < 86400000) {
            const waitTimeHours = Math.floor((86400000 - hasDaily) / 1000 / 60 / 60);
            const waitTimeMinutes = Math.floor(((86400000 - hasDaily) / 1000 / 60) % 60);
            await interaction.reply({
                content: `Raputad oma münditopsi, aga ei kõlise. Tule proovi hiljem uuesti!\n
                Pead ootama veel ${waitTimeHours} tundi ja ${waitTimeMinutes} minutit :hourglass:`,
                ephemeral: true,
            });
        }
    },
};

async function updateBalance(balance: Balance) {
    return await db<Balance>('balance')
        .where('userId', balance.userId)
        .update({ amount: balance.amount + 10, dailyCoin: new Date() });
}
