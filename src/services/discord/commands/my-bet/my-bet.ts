import { escapeMarkdown, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { BetResult } from '../../../../database/models/bet.model.ts';
import { findUserInProgressBets } from '../../../../database/queries/bets.query.ts';
import { addPlatformToMatchId, RIOT_PLATFORM_LABEL } from '../../../riot-games/requests.ts';

export const myBet = {
    data: new SlashCommandBuilder().setName('my-bet').setDescription('Vaata kõiki oma aktiivseid panuseid'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const bets = await findUserInProgressBets(interaction.user.id);
        if (!bets.length) {
            await interaction.reply({ content: 'Sul ei ole ühtegi tulemuseta panust.', flags: MessageFlags.Ephemeral });
            return;
        }
        const heading = `Sinu aktiivsed panused (${bets.length}):\n\n`;
        const messages = [heading];
        for (const bet of bets) {
            const player = bet.gameName ? escapeMarkdown(`${bet.gameName}#${bet.tagLine ?? ''}`) : 'Tundmatu mängija';
            const entry =
                `**[${RIOT_PLATFORM_LABEL[bet.platformId]}] ${player}** · ${addPlatformToMatchId(bet.platformId, bet.gameId)}\n` +
                `Panus: **${bet.amount}** muumimünti · Ennustus: **${bet.guess === BetResult.WIN ? 'võit' : 'kaotus'}** · Koefitsent: **${bet.odds}**\n` +
                `Võimalik väljamakse enne lõivu: **${Math.round(bet.amount * bet.odds)}**.\n\n`;
            if (messages[messages.length - 1].length + entry.length > 2000) {
                messages.push(heading);
            }
            messages[messages.length - 1] += entry;
        }
        await interaction.reply({
            content: messages[0].trimEnd(),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
        for (const content of messages.slice(1)) {
            await interaction.followUp({
                content: content.trimEnd(),
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
        }
    },
};
