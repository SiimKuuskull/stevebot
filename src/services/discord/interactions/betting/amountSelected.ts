import {
    ActionRowBuilder,
    MessageFlags,
    type ModalActionRowComponentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { deleteInProgressBet, findUserExistingBet } from '../../../../database/queries/bets.query.ts';
import { findTrackedPlayer } from '../../../../database/queries/player.query.ts';
import { findInprogressGame } from '../../../../database/queries/steveGames.query.ts';
import { InteractionError } from '../../../../tools/errors.ts';
import { Interaction } from '../../../interaction.service.ts';
import { getActiveLeagueGame, getLatestFinishedMatchId } from '../../../game.service.ts';
import { addPlatformToMatchId } from '../../../riot-games/requests.ts';
import { updateBetAmount } from '../../../bet.service.ts';
import { type Player } from '../../../../database/models/player.model.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { type SteveGame } from '../../../../database/models/steveGame.model.ts';
import { BetResult } from '../../../../database/models/bet.model.ts';
import { displayBettingButtons } from '../../components/betDecision.ts';

export async function amountSelected(interaction: any) {
    const player = await findTrackedPlayer();
    const riotGame = await getActiveLeagueGame(player);
    const inprogressGame = await findInprogressGame();
    if (!riotGame || !inprogressGame || !player) {
        await interaction.reply({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (String(riotGame.gameId) !== inprogressGame.gameId || riotGame.platformId !== inprogressGame.platformId) {
        await interaction.reply({
            content: ':spy: | Ei leidnud teie panust. Palun proovige uuesti!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const existingBet = await findUserExistingBet(interaction.user.id, inprogressGame.id);
    if (!existingBet) {
        log(`Did not find ${interaction.user.id} bet on ${riotGame.gameId.toString()}`);
        await interaction.reply({
            content: ':spy: | Ei leidnud teie panust. Palun proovige uuesti!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const inprogressBet = existingBet?.guess;
    const inprogressAmount = existingBet?.amount;
    const hasFinished = await getHasCurrentGameFinished(player, inprogressGame);
    if (hasFinished === true) {
        await deleteInProgressBet(interaction.user.id, inprogressGame.id);
        await interaction.reply({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            flags: MessageFlags.Ephemeral,
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
                await updateBetAmount(interaction.user.id, inprogressGame.id, betAmount);
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
            await displayBettingButtons(interaction, betAmount, inprogressGame, player.puuid);
            return;
        }
    } else if (inprogressAmount !== 0 && inprogressBet !== BetResult.IN_PROGRESS) {
        await interaction.reply({
            content: ':older_man: | Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
}

async function getHasCurrentGameFinished(player: Player, game: SteveGame) {
    const finishedMatchId = await getLatestFinishedMatchId(player.puuid);
    return addPlatformToMatchId(game.platformId, game.gameId) === finishedMatchId;
}

async function displayCustomBetModal(interaction: any) {
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
        flags: MessageFlags.Ephemeral,
    });
}
