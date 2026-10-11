import { MessageFlags, type ButtonInteraction } from 'discord.js';
export async function bankruptcyDenied(interaction: ButtonInteraction) {
    await interaction.reply({
        content: `Otsustasid mitte pankroti avaldust sisse anda. Su kontoseis jääb samaks.`,
        components: [],
        flags: MessageFlags.Ephemeral,
    });
}
