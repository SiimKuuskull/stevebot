import { BetResult } from '../database/models/bet.model';
import { SteveGame } from '../database/models/steveGame.model';
import { findUserBalance, createUserBalance } from '../database/queries/balance.query';
import { createBet } from '../database/queries/bets.query';
import { findInprogressGame } from '../database/queries/steveGames.query';
import { InteractionError } from '../tools/errors';
import { log } from '../tools/logger';
import { getActiveLeagueGame } from './game.service';

export async function placeUserBet(userId: string, amount: number, game?: SteveGame) {
    let balance = await findUserBalance(userId);
    if (!balance) {
        balance = await createUserBalance({ userId });
    }
    if (balance.amount >= amount) {
        const { gameId } = await findInprogressGame();
        let gameStartTime = game?.gameStart;
        log(gameStartTime);
        if (!gameStartTime) {
            const leagueGame = await getActiveLeagueGame();
            gameStartTime = leagueGame.gameStartTime;
        }
        const betOdds = getBetOdds(gameStartTime);
        const bet = await createBet({
            userId: userId,
            amount: amount,
            gameId,
            odds: betOdds,
            gameStart: gameStartTime,
            guess: BetResult.IN_PROGRESS,
            result: BetResult.IN_PROGRESS,
        });
        return bet;
    } else {
        throw new InteractionError(
            `Sul pole piisavalt münte selle panuse jaoks! Sul on hetkel ${balance.amount} muumimünti `,
        );
    }
}

export function getBetOdds(startTime: number) {
    const gameLengthMinutes = Math.floor(Number(Date.now() - startTime) / 1000 / 60);
    let betOdds = 2;
    if (gameLengthMinutes <= 8) {
        betOdds = 2;
    } else if (gameLengthMinutes <= 12) {
        betOdds = 1.6;
    } else if (gameLengthMinutes < 20) {
        betOdds = 1.4;
    } else if (gameLengthMinutes >= 20) {
        betOdds = 1.1;
    } else {
        return betOdds;
    }
    return betOdds;
}
