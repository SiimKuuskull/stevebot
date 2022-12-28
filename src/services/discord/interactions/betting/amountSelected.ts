import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { deleteinProgressBet, findUserBetOdds, findUserExistingBet } from '../../../../database/queries/bets.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { InteractionError } from '../../../../tools/errors';
import { Interaction } from '../../../interaction.service';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { getBetOdds, updateBetAmount, updateBetOdds } from '../../../bet.service';
import { Player } from '../../../../database/models/player.model';
import { log, LoggerType } from '../../../../tools/logger';
import { SteveGame } from '../../../../database/models/steveGame.model';
import { BetResult } from '../../../../database/models/bet.model';
import { displayBettingButtons } from '../../components/betDecision';

export async function amountSelected(interaction) {
    const player = await findTrackedPlayer();
    const riotGame = await getActiveLeagueGame(player);
    const inprogressGame = await findInprogressGame();
    if (!riotGame) {
        await interaction.reply({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            ephemeral: true,
        });
        return;
    }
    const existingBet = await findUserExistingBet(interaction.user.id, riotGame.gameId.toString());
    const inprogressBet = existingBet?.guess;
    if (!inprogressGame) {
        await deleteinProgressBet(interaction.user.id, inprogressBet);
        await interaction.reply({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
        });
        return;
    }
    const inprogressAmount = existingBet?.amount;
    const game = await findInprogressGame();
    const hasFinished = await getHasCurrentGameFinished(player, game);
    if (hasFinished === true) {
        await interaction.reply({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            ephemeral: true,
        });
        return;
    }
    if (!existingBet) {
        await interaction.reply({
            content: ':spy: | Ei leidnud teie panust. Palun proovige uuesti!',
            components: [],
            ephemeral: true,
        });
        return;
    }
    if (inprogressAmount === 0 && inprogressBet === BetResult.IN_PROGRESS) {
        const betSelection = String(interaction.values);
        if (betSelection === 'custom') {
            await displayCustomBetModal(interaction);
            return;
        }
        if (betSelection !== 'custom') {
            const betAmount = Number(interaction.values);
            try {
                await updateBetAmount(interaction.user.id, game.gameId, betAmount);
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
            await displayBettingButtons(interaction, betAmount, inprogressGame);
        }
    } else if (inprogressAmount !== 0 && inprogressBet !== BetResult.IN_PROGRESS) {
        await interaction.reply({
            content: ':older_man: | Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
            components: [],
            ephemeral: true,
        });
        return;
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
