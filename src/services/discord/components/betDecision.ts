import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SteveGame } from '../../../database/models/steveGame.model';
import { findUserBetOdds } from '../../../database/queries/bets.query';
import { findGameMetaBySteveGameId } from '../../../database/queries/gameMeta.query';
import { findUserById } from '../../../database/queries/users.query';
import { getBetOdds, updateBetOdds } from '../../bet.service';
import { Interaction } from '../../interaction.service';
import { STEVE } from '../../steve.service';

export async function displayBettingButtons(interaction, amount: number, game: SteveGame) {
    const userId = interaction.user.id;
    const oldOdds = await findUserBetOdds(interaction.user.id, String(game.gameId));
    const newOdds = getBetOdds(game?.gameStart);
    const rowButton = await getBetDecisionButtons(userId, game.id);
    if (oldOdds !== newOdds) {
        await updateBetOdds(userId, String(game?.gameId), newOdds);
        await interaction.update({
            content: `Panustad **${amount}** muumimünti. **NB! Koefitsenti kohandati**. Uus koefitsent: **${newOdds}**`,
            components: [rowButton],
            ephemeral: true,
        });
    } else {
        await interaction.update({
            content: `Panustad **${amount}** muumimünti`,
            components: [rowButton],
            ephemeral: true,
        });
    }
}

async function getBetDecisionButtons(userId: string, steveGameId: number) {
    const [user, gameMeta] = await Promise.all([findUserById(userId), findGameMetaBySteveGameId(steveGameId)]);
    const steveTeamId = gameMeta.meta.participants.find((player) => player.PuuId === STEVE.puuid)?.teamId;
    const participatingSummoners = gameMeta.meta.participants.map((participant) => participant.PuuId);
    const isBetLoseAllowed =
        !participatingSummoners.includes(user?.summonerId) ||
        gameMeta.meta.participants.some((player) => player.PuuId === user.summonerId && player.teamId !== steveTeamId);
    const isBetWinAllowed =
        !participatingSummoners.includes(user?.summonerId) ||
        gameMeta.meta.participants.some((player) => player.PuuId === user.summonerId && player.teamId === steveTeamId);
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
