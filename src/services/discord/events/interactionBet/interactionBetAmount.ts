import { BaseInteraction } from 'discord.js';
import { findUserBetDecisionandGameId, placeUserBet } from '../../../../database/queries/placeBet.query';
import { findExistingActiveGame } from '../../../../database/queries/steveGames.query';
import { betWinLose } from '../../commands/place-bet/betWinLose';

export const interactionBetAmount = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction) => {
        if (interaction.isSelectMenu()) {
            if (interaction.customId === 'selectBetAmount') {
                const activeGameId = (await findExistingActiveGame()).gameId;
                if (!(await findUserBetDecisionandGameId(interaction.user.tag, activeGameId))?.guess) {
                    const betAmount = Number(interaction.values);
                    await placeUserBet(interaction.user.tag, interaction.user.id, betAmount);
                    await interaction.editReply({
                        content: 'Panustad  ' + betAmount + (await betWinLose(interaction)),
                    });
                } else {
                    await interaction.reply({
                        content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
                        components: [],
                    });
                }
            }
        }
    },
};
