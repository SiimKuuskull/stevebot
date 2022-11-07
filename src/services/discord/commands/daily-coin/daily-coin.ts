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
                content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: ${balance.amount} muumimünti.`,
                ephemeral: true,
                components: [],
            });
            return;
        }
        if (!balance.dailyCoin) {
            await updateBalance(balance.userId);
            await interaction.reply({
                content: `Väike Muum viskas su münditopsi 10 muumimünti. Tule homme tagasi!`,
                ephemeral: true,
            });
            return;
        }
        const hasDaily = Date.now() - balance.dailyCoin?.getTime();
        if (hasDaily > 86400000) {
            await updateBalance(balance.userId);
            await interaction.reply({
                content: `Väike Muum viskas su münditopsi 10 muumimünti. Tule homme tagasi!`,
                ephemeral: true,
            });
        }
        if (hasDaily < 86400000) {
            await interaction.reply({
                content: `Raputad oma münditopsi, aga ei kõlise. Tule proovi hiljem uuesti!`,
                ephemeral: true,
            });
        }
    },
};

async function updateBalance(userId: string) {
    return await db<Balance>('balance')
        .where('userId', userId)
        .update({ amount: +10, dailyCoin: new Date() });
}