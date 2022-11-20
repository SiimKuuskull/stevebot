import { map } from 'bluebird';
import { Bet, BetResult } from '../../../../database/models/bet.model';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { findUserBalance, updateBalance } from '../../../../database/queries/balance.query';
import { findTopBet, updateUserBetDecision } from '../../../../database/queries/bets.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame, findSteveGameById, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log } from '../../../../tools/logger';
import { getMatchById } from '../../../riot-games/requests';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { sendChannelMessage, sendPrivateMessageToGambler } from '../../utils';
import { round } from 'lodash';

export const finisher = {
    interval: 30,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        const playerInfo = await findTrackedPlayer();
        const activeGameId = await getActiveLeagueGame(playerInfo);
        if (activeGameId) {
            log(`Game ${activeGameId?.gameId} in progress`);
            return;
        }
        const finishedGameId = await getLatestFinishedLeagueGame(playerInfo.puuid);
        const match = await getMatchById(`EUN1_${finishedGameId}`);
        const lastGame = await findSteveGameById(match.info.gameId);
        if (lastGame?.gameStatus === SteveGameStatus.IN_PROGRESS) {
            const playerResult = match.info.participants.find((x) => {
                return x.puuid === playerInfo.puuid;
            });
            await updateSteveGame(match.info.gameId, {
                gameStatus: SteveGameStatus.COMPLETED,
                gameResult: playerResult.win,
                gameEnd: match.info.gameEndTimeStamp,
            });
            await updateUserBetDecision(match.info.gameId, {
                result: playerResult.win ? BetResult.WIN : BetResult.LOSE,
            });
            const topBetsSorted = await findTopBet(match.info.gameId);
            log(
                `Suurimad panustajad see mäng:\n${topBetsSorted
                    .map((user) => {
                        return `${user.userId} ${user.amount} ${user.guess}\n`;
                    })
                    .toString()
                    .replaceAll(',', '')} `,
            );
            sendChannelMessage(`:bell: | Steve mäng lõppes. Steve ${playerResult.win ? 'võitis' : 'kaotas'}!`);
            await map(topBetsSorted, async (betUserDecision: Bet) => {
                const { amount, hasPenaltyChanged } = await getBalanceChange(betUserDecision);
                const balance = await updateBalance(betUserDecision.userId, amount, hasPenaltyChanged);
                const message = `Steve ${
                    betUserDecision.result === BetResult.WIN ? 'võitis' : 'kaotas'
                } oma mängu! Sa ${
                    betUserDecision.guess === betUserDecision.result ? 'võitsid' : 'kaotasid'
                } ${amount}, su uus kontoseis on ${balance.amount} muumimünti`;
                sendPrivateMessageToGambler(message, betUserDecision.userId);
            });
            log(`Game ${finishedGameId} resulted`);
        }
    },
};

async function getBalanceChange(bet: Bet) {
    const balance = await findUserBalance(bet.userId);
    const amount = round(bet.amount * bet.odds - bet.amount * balance.penalty);
    if (bet.guess !== bet.result) {
        return { amount: 0, hasPenaltyChanged: Boolean(balance.penalty) };
    }
    return { amount, hasPenaltyChanged: Boolean(balance.penalty) };
}
