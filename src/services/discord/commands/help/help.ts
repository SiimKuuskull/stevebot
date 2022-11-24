import { SlashCommandBuilder } from '@discordjs/builders';
export const helpCommand = {
    data: new SlashCommandBuilder().setName('help').setDescription('Nimekiri kõikidest commandidest'),
    execute: async (interaction) => {
        const commands = `Kasutatavad commandid:\n
        ***/my-balance*** - vaata oma münditasku hetkeseisu\n
        ***/place-bet*** - panusta käimasolevale mängule\n
        ***/my-bet*** - vaata oma aktiivset panust\n
        ***/bet-history*** - kuva enda kõik tehtud panused\n
        ***/leaderboard*** - kuva panustajate edetabel`;
        await interaction.reply({ content: commands, ephemeral: true });
    },
};
