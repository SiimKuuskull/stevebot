import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { findUserExistingBet } from '../../../../database/queries/bets.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { InteractionError } from '../../../../tools/errors';
import { Interaction } from '../../../interaction.service';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { placeUserBet } from '../../../bet.service';
import { Player } from '../../../../database/models/player.model';
import { log, LoggerType } from '../../../../tools/logger';
import { SteveGame } from '../../../../database/models/steveGame.model';

export async function amountSelected(interaction) {
    const player = await findTrackedPlayer();
    const riotGame = await getActiveLeagueGame(player);
    if (!riotGame) {
        await interaction.reply({
            content: 'Hetkel ei ole aktiivset mängu! Steve XP waste.. :rolling_eyes: ',
            components: [],
        });
        return;
    }
    const existingBet = await findUserExistingBet(interaction.user.id, riotGame.gameId.toString());
    const game = await findInprogressGame();
    const hasFinished = await getHasCurrentGameFinished(player, game);
    if (!hasFinished && !existingBet) {
        const betSelection = String(interaction.values);
        if (betSelection === 'custom') {
            await displayCustomBetModal(interaction);
        }
        if (betSelection !== 'custom') {
            const betAmount = Number(interaction.values);
            try {
                await placeUserBet(interaction.user.id, betAmount, game);
            } catch (error) {
                if (!(error instanceof InteractionError)) {
                    log(error, LoggerType.ERROR);
                }
                const reply =
                    error instanceof InteractionError ? error.message : 'Midagi läks valesti..oopsie :flushed: ';
                await interaction.reply({
                    content: reply,
                    components: [],
                });
                return;
            }
            await displayBettingButtons(interaction, betAmount);
        }
    } else if (existingBet) {
        await interaction.reply({
            content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu! :older_man: ',
            components: [],
            ephemeral: true,
        });
    } else {
        await interaction.reply({
            content: 'Hetkel ei ole aktiivset mängu! Steve XP waste.. :rolling_eyes: ',
            components: [],
            ephemeral: true,
        });
    }
}

async function getHasCurrentGameFinished(player: Player, game: SteveGame) {
    const finishedGameId = await getLatestFinishedLeagueGame(player.puuid);
    return game.gameId === finishedGameId;
}

async function displayCustomBetModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(Interaction.AMOUNT_SELECTED_CUSTOM)
        .setTitle('Panusta enda soovitud kogus muumimünte!');
    const customBetAmountInput = new TextInputBuilder()
        .setCustomId('customBetInput')
        .setLabel('Sisesta oma panus!')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(5)
        .setMinLength(1)
        .setPlaceholder('Panusta vahemikus 1 - 100 000!')
        .setRequired(true);
    const firstActionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(customBetAmountInput);

    modal.addComponents(firstActionRow);
    await interaction.showModal(modal);
    await interaction.editReply({
        content: `Valisid muu koguse panustamise! Palun sisesta enda soovitud panus!`,
        components: [],
        ephemeral: true,
    });
}

export async function displayBettingButtons(interaction, amount: number) {
    const rowButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(Interaction.BET_WIN).setLabel('Steve VÕIDAB!').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(Interaction.BET_LOSE).setLabel('Steve KAOTAB!').setStyle(ButtonStyle.Danger),
    );
    await interaction.update({ content: `Panustad ${amount} muumimünti`, components: [rowButton], ephemeral: true });
}
