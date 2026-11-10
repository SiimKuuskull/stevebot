import { BetResult } from '../../../../database/models/bet.model.ts';
import { cancelBettingDraft, confirmBet, loadBettingDraft } from '../../../bet.service.ts';
import { Interaction } from '../../../interaction.service.ts';
import { displayBettingButtons } from '../../components/betDecision.ts';
import { bettingPlayerLabel } from '../../components/bettingMenu.ts';
import { readBettingReference, updateBettingInteraction } from './response.ts';

export async function guessSelected(interaction: any) {
    await updateBettingInteraction(interaction, async () => {
        const reference = readBettingReference(interaction.customId, [
            Interaction.BET_WIN,
            Interaction.BET_LOSE,
            Interaction.BET_CANCEL,
        ]);
        if (reference.action === Interaction.BET_CANCEL) {
            await cancelBettingDraft(interaction.user.id, reference);
            await interaction.editReply({ content: 'Panus tühistatud!', components: [] });
            return;
        }
        const { context } = await loadBettingDraft(interaction.user.id, reference);
        const guess = reference.action === Interaction.BET_WIN ? BetResult.WIN : BetResult.LOSE;
        const result = await confirmBet(interaction.user.id, reference, guess, reference.odds!, context);
        if (!result.confirmed) {
            await displayBettingButtons(interaction, result.bet, context, true);
            return;
        }
        await interaction.editReply({
            content: `${bettingPlayerLabel(context)}\nPakkumine: **${guess === BetResult.WIN ? 'võidab' : 'kaotab'}!** Panus: **${result.bet.amount}** muumimünti`,
            components: [],
        });
    });
}
