import { BaseInteraction } from 'discord.js';
import { findUserBetDecisionandGameId, placeUserBet } from '../../../../database/queries/placeBet.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { InteractionError } from '../../../../tools/errors';
import { getMatchById } from '../../../riot-games/requests';
import { betWinLose } from '../../commands/place-bet/betWinLose';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../game';

export const interactionBetAmount = {
    name: 'interactionCreate',
    once: false,
    _execute: async (interaction: BaseInteraction) => {
        if (!interaction.isSelectMenu() || interaction?.customId !== 'selectBetAmount') {
            return;
        }
        const player = await findTrackedPlayer();
        const activeGameId = await getActiveLeagueGame(player);
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
            const betAmount = Number(interaction.values);
            try {
                await placeUserBet(interaction.user.tag, interaction.user.id, betAmount);
            } catch (error) {
                const reply = error instanceof InteractionError ? error.message : 'Midagi läks pekki';
                await interaction.reply({
                    content: reply,
                    components: [],
                });
            }

            await interaction.editReply({
                content: 'Panustad  ' + betAmount + (await betWinLose(interaction)),
            });
        } else if (isThereABet === true) {
            await interaction.reply({
                content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
                components: [],
            });
        }
    },
    get execute() {
        return this._execute;
    },
    set execute(value) {
        this._execute = value;
    },
};

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
