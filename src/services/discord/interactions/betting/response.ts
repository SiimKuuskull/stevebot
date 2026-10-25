import { MessageFlags } from 'discord.js';
import { InteractionError } from '../../../../tools/errors.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { EXPIRED_BET_MESSAGE } from '../../../bet.service.ts';
import { type BettingAction, parseBettingCustomId } from '../../../interaction.service.ts';

export function readBettingReference(customId: unknown, actions: BettingAction[]) {
    const reference = parseBettingCustomId(customId);
    if (!reference || !actions.includes(reference.action)) {
        throw new InteractionError(EXPIRED_BET_MESSAGE);
    }
    return reference;
}

export async function replyBettingError(interaction: any, error: unknown, deferred: boolean) {
    if (!(error instanceof InteractionError)) {
        log(error, LoggerType.ERROR);
    }
    const response = {
        content: error instanceof InteractionError ? error.message : 'Midagi läks valesti. Palun proovi hiljem uuesti.',
        components: [],
    };
    if (deferred) {
        await interaction.editReply(response);
    } else {
        await interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
    }
}

export async function updateBettingInteraction(interaction: any, action: () => Promise<void>) {
    await interaction.deferUpdate();
    try {
        await action();
    } catch (error) {
        await replyBettingError(interaction, error, true);
    }
}
