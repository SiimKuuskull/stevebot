import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { type BettingGame, startBettingDraft } from '../../bet.service.ts';
import { bettingCustomId, Interaction } from '../../interaction.service.ts';
import { useBettingAccount } from '../../registration.service.ts';

export function bettingPlayerLabel(context: BettingGame) {
    return `[${context.game.platformId}] ${context.player.gameName}#${context.player.tagLine}`;
}

export async function showBetAmountMenu(interaction: any, context: BettingGame, notice?: string) {
    const { balance } = await useBettingAccount(interaction.user);
    const bet = await startBettingDraft(interaction.user.id, context);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(bettingCustomId(Interaction.AMOUNT_SELECTED, { steveGameId: bet.steveGameId, betId: bet.id }))
        .setPlaceholder('Vali panuse suurus')
        .addOptions(
            ...['10', '20', '50', '100']
                .filter((amount) => Number(amount) <= balance.amount)
                .map((amount) => ({
                    label: amount,
                    description: `Panustad ${amount} muumimünti`,
                    value: amount,
                })),
            { label: 'Muu kogus', description: 'Panusta enda soovitud kogus', value: 'custom' },
        );
    const seconds = Math.max(0, Math.floor((Date.now() - context.startTime) / 1000));
    const duration = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    await interaction.editReply({
        content: `${bettingPlayerLabel(context)}\nMängu aeg: **${duration}**\nKoefitsent: **${bet.odds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!${notice ? `\n${notice}` : ''}`,
        components: [new ActionRowBuilder().addComponents(menu)],
    });
}
