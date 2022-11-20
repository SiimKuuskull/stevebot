import { map } from 'bluebird';
import { Bet, BetResult } from '../../../../database/models/bet.model';
import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { findUserBalance, updateBalance } from '../../../../database/queries/balance.query';
import { findTopBet, resultBetsByGameId } from '../../../../database/queries/bets.query';
import { findTrackedPlayer } from '../../../../database/queries/player.query';
import { findInprogressGame, findSteveGameById, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log } from '../../../../tools/logger';
import { getMatchById } from '../../../riot-games/requests';
import { getActiveLeagueGame, getLatestFinishedLeagueGame } from '../../../game.service';
import { sendChannelMessage, sendPrivateMessageToGambler } from '../../utils';
import { round } from 'lodash';
import { Balance } from '../../../../database/models/balance.model';

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
            await resultBetsByGameId(match.info.gameId, {
                result: playerResult.win ? BetResult.WIN : BetResult.LOSE,
            });
            const topBets = await findTopBet(match.info.gameId);
            log(
                `Suurimad panustajad see mäng:\n${topBets
                    .map((user) => {
                        return `${user.userId} ${user.amount} ${user.guess}\n`;
                    })
                    .toString()
                    .replaceAll(',', '')} `,
            );
            sendChannelMessage(`:bell: | Steve mäng lõppes. Steve ${playerResult.win ? 'võitis' : 'kaotas'}!`);
            await map(topBets, async (bet: Bet) => {
                const { amount, hasPenaltyChanged } = await getBalanceChange(bet);
                const balance = await updateBalance(bet.userId, amount, hasPenaltyChanged);
                const message = getMessage(bet, amount, balance);
                sendPrivateMessageToGambler(message, bet.userId);
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

function getMessage(bet: Bet, amount: number, balance: Balance) {
    const playerResultMessage = bet.result === BetResult.WIN ? 'võitis' : 'kaotas';
    const betResultMessage = bet.guess === bet.result ? 'võitsid' : 'kaotasid';
    const balanceChangeMessage = bet.guess === bet.result ? amount : bet.amount;
    return `Steve ${playerResultMessage} oma mängu! Sa ${betResultMessage} ${balanceChangeMessage}, su uus kontoseis on ${balance.amount} muumimünti`;
}
