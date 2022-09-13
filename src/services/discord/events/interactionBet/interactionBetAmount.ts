import { BaseInteraction } from 'discord.js';
import { findUserBetDecision, placeUserBet } from '../../../../database/queries/placeBet.query';
import { betWinLose } from '../../commands/place-bet/betWinLose';

export const interactionBetAmount = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction) => {
        if (interaction.isSelectMenu()) {
            if (interaction.customId === 'selectBetAmount') {
                if (!(await findUserBetDecision(interaction.user.tag))?.guess) {
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
