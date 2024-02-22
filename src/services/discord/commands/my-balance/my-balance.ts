import { SlashCommandBuilder } from '@discordjs/builders';
import { TransactionType } from '../../../../database/models/transactions.model';
import { createUserBalance, findUserBalance } from '../../../../database/queries/balance.query';
import { makeTransaction } from '../../../transaction.service';
import { createBettingAccount } from '../../../registration.service';
import { findUserById } from '../../../../database/queries/users.query';

export const myBalance = {
    data: new SlashCommandBuilder().setName('my-balance').setDescription('Vaata oma münditaskut!'),
    execute: async (interaction) => {
        let balance = await findUserBalance(interaction.user.id);
        let bettingAccount = await findUserById(interaction.user.id);
        if (!bettingAccount) {
            [balance] =  await createBettingAccount(interaction.user.id, interaction.user.tag);

            await interaction.reply({ content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: **100** muumimünti. :wink:`, ephemeral: true });
        }
        
        await interaction.reply({ content: `Sul on **${balance.amount}** muumimünti`, ephemeral: true });
    },
};
