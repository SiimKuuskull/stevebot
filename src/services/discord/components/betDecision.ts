import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { type SteveGame } from '../../../database/models/steveGame.model.ts';
import { findUserBetOdds } from '../../../database/queries/bets.query.ts';
import { findGameMetaBySteveGameId } from '../../../database/queries/gameMeta.query.ts';
import { findUserById } from '../../../database/queries/users.query.ts';
import { getBetOdds, updateBetOdds } from '../../bet.service.ts';
import { Interaction } from '../../interaction.service.ts';

export async function displayBettingButtons(
    interaction: any,
    amount: number,
    game: SteveGame,
    trackedPlayerPuuid: string,
) {
    const userId = interaction.user.id;
    const oldOdds = await findUserBetOdds(interaction.user.id, String(game.gameId));
    const newOdds = getBetOdds(game?.gameStart);
    const rowButton = await getBetDecisionButtons(userId, game.id, trackedPlayerPuuid);
    if (oldOdds !== newOdds) {
        await updateBetOdds(userId, String(game?.gameId), newOdds);
        await interaction.update({
            content: `Panustad **${amount}** muumimünti. **NB! Koefitsenti kohandati**. Uus koefitsent: **${newOdds}**`,
            components: [rowButton],
            flags: MessageFlags.Ephemeral,
        });
    } else {
        await interaction.update({
            content: `Panustad **${amount}** muumimünti`,
            components: [rowButton],
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function getBetDecisionButtons(userId: string, steveGameId: number, trackedPlayerPuuid: string) {
    const [user, gameMeta] = await Promise.all([findUserById(userId), findGameMetaBySteveGameId(steveGameId)]);
    if (!user) {
        throw new Error('User is missing');
    }
    if (!gameMeta) {
        throw new Error('Game meta is missing');
    }
    const trackedTeamId = gameMeta.meta.participants.find((player) => player.puuid === trackedPlayerPuuid)?.teamId;
    const bettingPlayer = gameMeta.meta.participants.find((player) => player.puuid === user.puuid);
    const isBetLoseAllowed = !bettingPlayer || (trackedTeamId !== undefined && bettingPlayer.teamId !== trackedTeamId);
    const isBetWinAllowed = !bettingPlayer || (trackedTeamId !== undefined && bettingPlayer.teamId === trackedTeamId);
    const buttons: ButtonBuilder[] = [];
    if (isBetWinAllowed) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(Interaction.BET_WIN)
                .setLabel('Steve VÕIDAB!')
                .setStyle(ButtonStyle.Success),
        );
    }
    if (isBetLoseAllowed) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(Interaction.BET_LOSE)
                .setLabel('Steve KAOTAB!')
                .setStyle(ButtonStyle.Danger),
        );
    }
    return new ActionRowBuilder().addComponents([
        ...buttons,
        new ButtonBuilder()
            .setCustomId(Interaction.BET_CANCEL)
            .setLabel('Tühista panus!')
            .setStyle(ButtonStyle.Secondary),
    ]);
}
