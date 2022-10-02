import { SlashCommandBuilder } from '@discordjs/builders';
import { getAllBalances, getAllCurrency } from '../../../../database/queries/balance.query';

export const moominCoin = {
    data: new SlashCommandBuilder().setName('moomincoin').setDescription('Vaata, kui palju on muumimünte ringluses!'),
    execute: async (interaction) => {
        const amount = await getAllCurrency();
        const activePlayers = await getAllBalances();
        await interaction.reply({
            content: `Hetkel on ringluses ${amount} muumimünti. Aktiivsed muumid: ${activePlayers}`,
            ephemeral: true,
        });
    },
};
