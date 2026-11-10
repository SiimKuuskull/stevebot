import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { type Bet } from '../../../database/models/bet.model.ts';
import { type BettingGame, getAllowedBetGuesses } from '../../bet.service.ts';
import { bettingCustomId, Interaction } from '../../interaction.service.ts';
import { bettingPlayerLabel } from './bettingMenu.ts';

export async function displayBettingButtons(interaction: any, bet: Bet, context: BettingGame, oddsChanged = false) {
    const allowed = await getAllowedBetGuesses(interaction.user.id, context);
    const reference = { steveGameId: bet.steveGameId, betId: bet.id };
    const buttons: ButtonBuilder[] = [];
    if (allowed.win) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(bettingCustomId(Interaction.BET_WIN, reference, bet.odds))
                .setLabel(`${context.player.gameName} VÕIDAB!`.slice(0, 80))
                .setStyle(ButtonStyle.Success),
        );
    }
    if (allowed.lose) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(bettingCustomId(Interaction.BET_LOSE, reference, bet.odds))
                .setLabel(`${context.player.gameName} KAOTAB!`.slice(0, 80))
                .setStyle(ButtonStyle.Danger),
        );
    }
    buttons.push(
        new ButtonBuilder()
            .setCustomId(bettingCustomId(Interaction.BET_CANCEL, reference))
            .setLabel('Tühista panus!')
            .setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({
        content: `${bettingPlayerLabel(context)}\nPanustad **${bet.amount}** muumimünti. Koefitsent: **${bet.odds}**${oddsChanged ? '\nKoefitsent muutus. Palun kinnita oma panus uuesti.' : ''}`,
        components: [new ActionRowBuilder().addComponents(buttons)],
    });
}
