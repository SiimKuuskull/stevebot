import { BaseInteraction } from 'discord.js';
import { changeUserBalanceHoldLose } from '../../../../database/queries/balance.query';
import { findUserBetDecision, placeUserBetDecision } from '../../../../database/queries/placeBet.query';

export const interactionBetDecision = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction) => {
        if (interaction.isButton()) {
            const betAmount = (await findUserBetDecision(interaction.user.tag)).amount;
            await changeUserBalanceHoldLose(interaction.user.tag, betAmount);
            if (interaction.customId === 'winBet') {
                await placeUserBetDecision(interaction.user.tag, true);
                await interaction.update({
                    content: 'Steve võidab! Sinu panus: ' + (await findUserBetDecision(interaction.user.tag)).amount,
                    components: [],
                });
            }
            if (interaction.customId === 'loseBet') {
                await placeUserBetDecision(interaction.user.tag, false);
                await interaction.update({
                    content: ' Steve kaotab! Sinu panus: ' + (await findUserBetDecision(interaction.user.tag)).amount,
                    components: [],
                });
            }
        }
    },
};
