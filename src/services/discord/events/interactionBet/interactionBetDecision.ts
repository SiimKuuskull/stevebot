import { BaseInteraction } from 'discord.js';
import { changeUserBalanceHoldLose } from '../../../../database/queries/balance.query';
import {
    findUserBetDecision,
    findUserBetDecisionandGameId,
    placeUserBetDecision,
} from '../../../../database/queries/placeBet.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';

export const interactionBetDecision = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction) => {
        if (interaction.isButton()) {
            const betAmount = (await findUserBetDecision(interaction.user.tag)).amount;
            await changeUserBalanceHoldLose(interaction.user.tag, betAmount);
            if (interaction.customId === 'winBet') {
                const activeGame = (await findInprogressGame()).gameId;
                await placeUserBetDecision(interaction.user.tag, true);
                await interaction.update({
                    content:
                        'Steve võidab! Sinu panus: ' +
                        (
                            await findUserBetDecisionandGameId(interaction.user.tag, activeGame)
                        ).amount,
                    components: [],
                });
            }
            if (interaction.customId === 'loseBet') {
                await placeUserBetDecision(interaction.user.tag, false);
                const activeGame = (await findInprogressGame()).gameId;
                await interaction.update({
                    content:
                        ' Steve kaotab! Sinu panus: ' +
                        (
                            await findUserBetDecisionandGameId(interaction.user.tag, activeGame)
                        ).amount,
                    components: [],
                });
            }
        }
    },
};
