import { log } from '../../../../tools/logger.ts';
import { Interaction } from '../../../interaction.service.ts';
import { amountSelected } from '../../interactions/betting/amountSelected.ts';
import { amountSelectedCustom } from '../../interactions/betting/amountSelectedCustom.ts';
import { guessSelected } from '../../interactions/betting/guessSelected.ts';
import { bankruptcyDeclared } from '../../interactions/loans/bankruptcyDeclared.ts';
import { bankruptcyDenied } from '../../interactions/loans/bankruptcyDenied.ts';

const actionByInteraction = {
    [Interaction.AMOUNT_SELECTED]: amountSelected,
    [Interaction.AMOUNT_SELECTED_CUSTOM]: amountSelectedCustom,
    [Interaction.BANKRUPTCY_DECLARED]: bankruptcyDeclared,
    [Interaction.BANKRUPTCY_DENIED]: bankruptcyDenied,
    [Interaction.BET_LOSE]: guessSelected,
    [Interaction.BET_WIN]: guessSelected,
    [Interaction.BET_CANCEL]: guessSelected,
};

export const interaction = {
    name: 'interactionCreate',
    once: false,
    execute: async (interaction: any, client: any) => {
        const customId = interaction.customId as Interaction;
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
