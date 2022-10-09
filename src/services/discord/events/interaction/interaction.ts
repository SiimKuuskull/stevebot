import { BaseInteraction } from 'discord.js';
import { log } from '../../../../tools/logger';
import { Interaction } from '../../../interaction.service';
import { amountSelected } from '../../interactions/betting/amountSelected';
import { amountSelectedCustom } from '../../interactions/betting/amountSelectedCustom';
import { guessSelected } from '../../interactions/betting/guessSelected';
import { bankruptcyDeclared } from '../../interactions/loans/bankruptcyDeclared';
import { bankruptcyDenied } from '../../interactions/loans/bankruptcyDenied';

const actionByInteraction = {
    [Interaction.AMOUNT_SELECTED]: amountSelected,
    [Interaction.AMOUNT_SELECTED_CUSTOM]: amountSelectedCustom,
    [Interaction.BANKRUPTCY_DECLARED]: bankruptcyDeclared,
    [Interaction.BANKRUPTCY_DENIED]: bankruptcyDenied,
    [Interaction.BET_LOSE]: guessSelected,
    [Interaction.BET_WIN]: guessSelected,
};

export const interaction = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: BaseInteraction, client) => {
        const customId = (interaction as any).customId;
        if (interaction.isCommand()) {
            log(`${interaction.user.tag} in #${interaction.channel.name} used ${interaction.commandName}`);
            const command = client.commands.get(interaction.commandName.toLowerCase());
            if (command) {
                await command.execute(interaction);
            }
        } else if (actionByInteraction[customId]) {
            log(`${interaction.user.tag} in #${interaction.channel.name} used ${customId}`);
            await actionByInteraction[customId](interaction);
        } else {
            log(`${interaction.user.tag} in ${interaction.channel.name} did something unknown`);
        }
    },
};
