import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { changeUserBalanceWinByGuess } from '../../../../database/queries/balance.query';
import { findUserBetDecisionByGameId, updateUserBetDecision } from '../../../../database/queries/placeBet.query';
import {
    findInprogressGame,
    findLastSteveGame,
    playerInfo,
    updateSteveGame,
} from '../../../../database/queries/steveGames.query';
import { log } from '../../../../tools/logger';
import { getActivegameBySummonerId, getMatchById } from '../../../riot-games/requests';
import { sendChannelMessage } from '../../utils';

export const finisher = {
    interval: 5,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            return;
        }
        const activeGameId = (await getActivegameBySummonerId(playerInfo.id)).gameId;
        if (!activeGameId) {
            const lastSteveGame = await findLastSteveGame();
            const match = await getMatchById(lastSteveGame);
            const matchResult = match.info.participants;
            const playerResult = matchResult.find((x) => {
                return x.puuid === playerInfo.puuid;
            });
            await updateSteveGame(game.id, { gameStatus: SteveGameStatus.COMPLETED, gameResult: playerResult.win });
            await updateUserBetDecision(game.id, { result: playerResult.win });
            const betDecision = await findUserBetDecisionByGameId(activeGameId);
            if ((playerResult.win = true && betDecision.guess === playerResult.win)) {
                await changeUserBalanceWinByGuess(true, betDecision.amount);
            }
            log('Steve mäng sai läbi! Andmebaas uuendatud!');
            if (betDecision.result === true) {
                sendChannelMessage('Steve mäng lõppes. Steve võitis!');
            }
            if (betDecision.result === false) {
                sendChannelMessage('Steve mäng lõppes. Steve kaotas!');
            }
        }
    },
};
