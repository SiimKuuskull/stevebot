import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { canManageTracking } from '../players/players.ts';
export const helpCommand = {
    data: new SlashCommandBuilder().setName('help').setDescription('Nimekiri kõikidest commandidest'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        let commands = `Kasutatavad commandid:\n
        ***/my-balance*** - vaata oma münditasku hetkeseisu\n
        ***/place-bet*** - panusta käimasolevale mängule\n
        ***/my-bet*** - vaata kõiki oma aktiivseid panuseid\n
        ***/bet-history*** - kuva enda kõik tehtud panused\n
        ***/leaderboard*** - kuva panustajate edetabel \n
        ***/daily-coin*** - saad iga päev tasuta muumimünte\n`;
        if (canManageTracking(interaction)) {
            commands +=
                '\n**Server adminnile:**\n/track-player — lisa või taasta mängija jälgimine (kuni 3 mängijat).\n/untrack-player — peata jälgimine, säilitades mängud ja panused.\n';
        }
        await interaction.reply({ content: commands, flags: MessageFlags.Ephemeral });
    },
};
