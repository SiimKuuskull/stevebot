import { DateTime } from 'luxon';
import { db } from '../database/db';
import { Bet, BetResult } from '../database/models/bet.model';
import { SteveGame } from '../database/models/steveGame.model';
import { findUserBalance } from '../database/queries/balance.query';
import { createBet } from '../database/queries/bets.query';
import { findInprogressGame } from '../database/queries/steveGames.query';
import { InteractionError } from '../tools/errors';
import { getActiveLeagueGame } from './game.service';
import { createBettingAccount } from './registration.service';

export async function placeUserBet(interactionUser: { id: string; tag: string }, amount: number, game?: SteveGame) {
    let balance = await findUserBalance(interactionUser.id);
    if (!balance) {
        [balance] = await createBettingAccount(interactionUser.id, interactionUser.tag);
    }
    if (balance.amount >= amount) {
        const { gameId } = await findInprogressGame();
        let gameStartTime = game?.gameStart;
        if (!gameStartTime) {
            const leagueGame = await getActiveLeagueGame();
            gameStartTime = leagueGame?.gameStartTime;
        }
        const betOdds = getBetOdds(gameStartTime);

        const bet = await createBet({
            userId: interactionUser.id,
            amount,
            gameId,
            odds: betOdds,
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
    /*const gameLengthMinutes = Math.floor(Number(Date.now() - startTime) / 1000 / 60); */
    const beginTime = DateTime.fromISO(new Date(startTime).toISOString());
    const realTime = DateTime.fromISO(new Date().toISOString());
    const { minutes: gameLengthMinutes } = realTime.diff(beginTime, 'minutes').toObject();
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

export async function updateBetOdds(userId: string, gameId: string, odds: number) {
    await db<Bet>('bets').where({ userId, gameId }).update({ odds });
}

export async function updateBetAmount(userId: string, gameId: string, amount: number) {
    const updatedBet = await db<Bet>('bets').where({ userId, gameId }).update({ amount });
    return updatedBet;
}
