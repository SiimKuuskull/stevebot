import { BaseInteraction } from 'discord.js';
import { BetGuess } from '../../../../database/models/bet.model';
import { changeUserBalanceHoldLose } from '../../../../database/queries/balance.query';
import {
    deleteinProgressBet,
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
            const inProgressGame = await findInprogressGame();
            if (!inProgressGame) {
                await deleteinProgressBet(interaction.user.id, inProgressGame.gameId);
                await interaction.reply({
                    content: 'Kahjuks Steve mäng sai läbi. Oota järgmist mängu!',
                    components: [],
                    ephemeral: true,
                });
            }
            if (inProgressGame) {
                const betAmount = (await findUserBetDecision(interaction.user.tag)).amount;
                await changeUserBalanceHoldLose(interaction.user.tag, betAmount);
                if (interaction.customId === 'winBet') {
                    const activeGame = (await findInprogressGame()).gameId;
                    await placeUserBetDecision(interaction.user.tag, BetGuess.WIN);
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
                    await placeUserBetDecision(interaction.user.tag, BetGuess.LOSE);
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
        }
    },
};
