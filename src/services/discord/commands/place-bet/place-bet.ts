import { ActionRowBuilder, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { findAvailableBettingGames } from '../../../bet.service.ts';
import { Interaction } from '../../../interaction.service.ts';
import { bettingPlayerLabel, showBetAmountMenu } from '../../components/bettingMenu.ts';
import { replyBettingError } from '../../interactions/betting/response.ts';

const INCOMPLETE_LIST_NOTICE = 'Kõiki mänge ei õnnestunud kontrollida, seega võib nimekiri olla puudulik.';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Panusta käimasolevale mängule'),
    execute: async (interaction: any) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const { games, alreadyBet, unchecked } = await findAvailableBettingGames(interaction.user.id);
            const notice = unchecked ? INCOMPLETE_LIST_NOTICE : undefined;
            if (!games.length) {
                await interaction.editReply({
                    content: alreadyBet
                        ? 'Oled kõigile käimasolevatele mängudele juba panuse teinud.'
                        : 'Hetkel pole ühtegi mängu, millele saad panustada.',
                    components: [],
                });
            } else if (games.length === 1) {
                await showBetAmountMenu(interaction, games[0], notice);
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
                    content: `Vali mängija, kelle mängule panustada:${notice ? `\n${notice}` : ''}`,
                    components: [new ActionRowBuilder().addComponents(menu)],
                });
            }
        } catch (error) {
            await replyBettingError(interaction, error, true);
        }
    },
};
