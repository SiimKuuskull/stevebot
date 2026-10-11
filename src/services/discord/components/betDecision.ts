import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { type SteveGame } from '../../../database/models/steveGame.model.ts';
import { findUserBetOdds } from '../../../database/queries/bets.query.ts';
import { findGameMetaBySteveGameId } from '../../../database/queries/gameMeta.query.ts';
import { findUserById } from '../../../database/queries/users.query.ts';
import { getBetOdds, updateBetOdds } from '../../bet.service.ts';
import { Interaction } from '../../interaction.service.ts';
import { STEVE } from '../../steve.service.ts';

export async function displayBettingButtons(interaction: any, amount: number, game: SteveGame) {
    const userId = interaction.user.id;
    const oldOdds = await findUserBetOdds(interaction.user.id, String(game.gameId));
    const newOdds = getBetOdds(game?.gameStart);
    const rowButton = await getBetDecisionButtons(userId, game.id);
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

async function getBetDecisionButtons(userId: string, steveGameId: number) {
    const [user, gameMeta] = await Promise.all([findUserById(userId), findGameMetaBySteveGameId(steveGameId)]);
    if (!user) {
        throw new Error('User is missing');
    }
    if (!gameMeta) {
        throw new Error('Game meta is missing');
    }
    const steveTeamId = gameMeta.meta.participants.find((player) => player.puuid === STEVE.puuid)?.teamId;
    const participatingSummoners = gameMeta.meta.participants.map((participant) => participant.puuid);
    const isBetLoseAllowed =
        !participatingSummoners.includes(user.puuid as string) ||
        gameMeta.meta.participants.some((player) => player.puuid === user.puuid && player.teamId !== steveTeamId);
    const isBetWinAllowed =
        !participatingSummoners.includes(user.puuid as string) ||
        gameMeta.meta.participants.some((player) => player.puuid === user.puuid && player.teamId === steveTeamId);
    if (!isBetLoseAllowed) {
        return new ActionRowBuilder().addComponents([
            new ButtonBuilder()
                .setCustomId(Interaction.BET_WIN)
                .setLabel('Steve VÕIDAB!')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_CANCEL)
                .setLabel('Tühista panus!')
                .setStyle(ButtonStyle.Secondary),
        ]);
    }
    if (!isBetWinAllowed) {
        return new ActionRowBuilder().addComponents([
            new ButtonBuilder()
                .setCustomId(Interaction.BET_LOSE)
                .setLabel('Steve KAOTAB!')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_CANCEL)
                .setLabel('Tühista panus!')
                .setStyle(ButtonStyle.Secondary),
        ]);
    }
    return new ActionRowBuilder().addComponents([
        new ButtonBuilder().setCustomId(Interaction.BET_WIN).setLabel('Steve VÕIDAB!').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(Interaction.BET_LOSE).setLabel('Steve KAOTAB!').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(Interaction.BET_CANCEL)
            .setLabel('Tühista panus!')
            .setStyle(ButtonStyle.Secondary),
    ]);
}
