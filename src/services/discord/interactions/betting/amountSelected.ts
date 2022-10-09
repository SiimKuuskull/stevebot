import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { findUserBetDecisionandGameId } from '../../../../database/queries/bets.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { InteractionError } from '../../../../tools/errors';
import { Interaction } from '../../../interaction.service';
import { getMatchById } from '../../../riot-games/requests';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { placeUserBet } from '../../../bet.service';

export async function amountSelected(interaction) {
    const player = await findTrackedPlayer();
    const { gameId: activeGameId } = await getActiveLeagueGame(player);
    if (!activeGameId) {
        await interaction.reply({
            content: 'Hetkel ei ole aktiivset mängu! Steve XP waste',
            components: [],
        });
        return;
    }
    const isThereABet = await findBet(interaction.user.tag, activeGameId);
    const isThereNewGame = await findNewGame();
    if (isThereNewGame === true && isThereABet === false) {
        const betSelection = String(interaction.values);
        if (betSelection === 'custom') {
            await displayCustomBetModal(interaction);
        }
        if (betSelection !== 'custom') {
            const betAmount = Number(interaction.values);
            try {
                await placeUserBet(interaction.user.tag, interaction.user.id, betAmount);
            } catch (error) {
                const reply = error instanceof InteractionError ? error.message : 'Midagi läks pekki';
                await interaction.reply({
                    content: reply,
                    components: [],
                });
                return;
            }
            await displayBettingButtons(interaction, betAmount);
        }
    } else if (isThereABet === true) {
        await interaction.reply({
            content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
            components: [],
        });
    }
}

async function findNewGame() {
    const activeGameId = await findInprogressGame();
    const playerInfo = await findTrackedPlayer();
    const lastSteveGame = await getLatestFinishedLeagueGame(playerInfo.puuid);
    const match = await getMatchById(lastSteveGame);
    const newGame = false;
    if (activeGameId.gameId !== match.info.gameId) {
        const newGame = true;
        return newGame;
    }
    return newGame;
}
async function findBet(interactionUser, activeGame) {
    const betDecision = await findUserBetDecisionandGameId(interactionUser, activeGame);
    const betPlaced = false;
    if (betDecision) {
        const betPlaced = true;
        return betPlaced;
    }
    return betPlaced;
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