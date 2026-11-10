import { InteractionError } from '../../../../tools/errors.ts';
import { EXPIRED_BET_MESSAGE, loadBettingGame } from '../../../bet.service.ts';
import { Interaction, parseDatabaseId } from '../../../interaction.service.ts';
import { showBetAmountMenu } from '../../components/bettingMenu.ts';
import { updateBettingInteraction } from './response.ts';

export async function gameSelected(interaction: any) {
    await updateBettingInteraction(interaction, async () => {
        const id =
            Array.isArray(interaction.values) && interaction.values.length === 1
                ? parseDatabaseId(interaction.values[0])
                : undefined;
        if (interaction.customId !== Interaction.GAME_SELECTED || !id) {
            throw new InteractionError(EXPIRED_BET_MESSAGE);
        }
        await showBetAmountMenu(interaction, await loadBettingGame(id));
    });
}
