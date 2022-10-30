export async function bankruptcyDenied(interaction) {
    await interaction.reply({
        content: `Otsustasid mitte pankroti avaldust sisse anda. Su kontoseis jääb samaks.`,
        components: [],
        ephemeral: true,
    });
}
