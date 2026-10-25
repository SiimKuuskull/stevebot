import { ActionRowBuilder, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { findAvailableBettingGames } from '../../../bet.service.ts';
import { Interaction } from '../../../interaction.service.ts';
import { bettingPlayerLabel, showBetAmountMenu } from '../../components/bettingMenu.ts';
import { replyBettingError } from '../../interactions/betting/response.ts';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Panusta käimasolevale mängule'),
    execute: async (interaction: any) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const games = await findAvailableBettingGames(interaction.user.id);
            if (!games.length) {
                await interaction.editReply({
                    content: 'Hetkel pole ühtegi mängu, millele saad panustada.',
                    components: [],
                });
            } else if (games.length === 1) {
                await showBetAmountMenu(interaction, games[0]);
            } else {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId(Interaction.GAME_SELECTED)
                    .setPlaceholder('Vali mängija, kelle mängule panustada')
                    .addOptions(
                        games.map((context) => ({
                            label: bettingPlayerLabel(context).slice(0, 100),
                            value: String(context.game.id),
                        })),
                    );
                await interaction.editReply({
                    content: 'Vali mängija, kelle mängule panustada:',
                    components: [new ActionRowBuilder().addComponents(menu)],
                });
            }
        } catch (error) {
            await replyBettingError(interaction, error, true);
        }
    },
};
