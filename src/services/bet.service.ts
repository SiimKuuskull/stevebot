import { BetGuess, BetResult } from '../database/models/bet.model';
import { findUserBalance, createUserBalance, updateUserBalance } from '../database/queries/balance.query';
import { createBet } from '../database/queries/bets.query';
import { findInprogressGame } from '../database/queries/steveGames.query';
import { InteractionError } from '../tools/errors';
import { getActiveLeagueGame } from './game.service';
import { RiotActiveGame } from './riot-games/requests';

export async function placeUserBet(userName: string, userId: string, amount: number) {
    let balance = await findUserBalance(userId);
    if (!balance) {
        balance = await createUserBalance({ userName, userId });
    }
    if (balance.amount >= amount) {
        const { gameId } = await findInprogressGame();
        const leagueGame = await getActiveLeagueGame();
        const betOdds = getBetOdds(leagueGame);
        const bet = await createBet({
            userId: userId,
            userName: userName,
            amount: amount,
            gameId,
            odds: betOdds,
            gameStart: leagueGame.gameStartTime,
            guess: BetGuess.IN_PROGRESS,
            result: BetResult.IN_PROGRESS,
        });
        await updateUserBalance(userId, -bet.amount);
        return bet;
    } else {
        throw new InteractionError(
            `Sul pole piisavalt plege selle panuse jaoks! Sul on hetkel ${balance.amount} muumimünti `,
        );
    }
}

export function getBetOdds(game: RiotActiveGame) {
    const gameLengthMinutes = Math.floor(Number(Date.now() - game.gameStartTime) / 1000 / 60);
    let betOdds = 2;
    if (gameLengthMinutes <= 8) {
        betOdds = 2;
    }
    if (gameLengthMinutes <= 12) {
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
