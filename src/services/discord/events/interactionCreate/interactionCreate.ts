import { BaseInteraction } from 'discord.js';
import { changeUserBalanceHoldLose } from '../../../../database/queries/balance.query';
import { findUserBetDecision, placeUserBet, placeUserBetDecision } from '../../../../database/queries/placeBet.query';
import { log } from '../../../../tools/logger';
import { betWinLose } from '../../commands/place-bet/betWinLose';

export const interactionCreate = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction, client) => {
        if (interaction.isCommand()) {
            log(`${interaction.user.tag} in #${interaction.channel.name} used ${interaction.commandName}`);
            const command = client.commands.get(interaction.commandName.toLowerCase());
            if (command) {
                await command.execute(interaction);
            }
        } else if (interaction.isSelectMenu()) {
            if (interaction.customId === 'selectBetAmount') {
                if (!(await findUserBetDecision(interaction.user.tag))?.guess) {
                    const betAmount = Number(interaction.values);
                    await placeUserBet(interaction.user.tag, betAmount);
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
        } else if (interaction.isButton()) {
            const betAmount = (await findUserBetDecision(interaction.user.tag)).amount;
            await changeUserBalanceHoldLose(interaction.user.tag, betAmount);
            if (interaction.customId === 'winBet') {
                await placeUserBetDecision(interaction.user.tag, 'WIN');
                await interaction.update({
                    content: 'Steve võidab! Sinu panus: ' + (await findUserBetDecision(interaction.user.tag)).amount,
                    components: [],
                });
            }
            if (interaction.customId === 'loseBet') {
                await placeUserBetDecision(interaction.user.tag, 'LOSS');
                await interaction.update({
                    content: ' Steve kaotab! Sinu panus: ' + (await findUserBetDecision(interaction.user.tag)).amount,
                    components: [],
                });
            }
        }
    },
};
