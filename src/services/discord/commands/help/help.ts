import { SlashCommandBuilder } from '@discordjs/builders';
export const helpCommand = {
    data: new SlashCommandBuilder().setName('help').setDescription('Nimekiri kõikidest commandidest'),
    execute: async (interaction) => {
        const commands = `Kasutatavad commandid:\n
        /my-balance - Vaata oma münditasku hetkeseisu\n
        /place-bet - Panusta käimasolevale mängule\n
        /my-bet - Vaata oma aktiivset panust\n
        /bet-history - Kuva enda kõik tehtud panused\n
        /leaderboard - Kuva panustajate edetabel`;
        await interaction.reply({ content: commands, ephemeral: true });
    },
};
