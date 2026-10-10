import { DateTime } from 'luxon';
import { db } from '../database/db.ts';
import { type Bet, BetResult } from '../database/models/bet.model.ts';
import { type SteveGame } from '../database/models/steveGame.model.ts';
import { createBet } from '../database/queries/bets.query.ts';
import { findInprogressGame } from '../database/queries/steveGames.query.ts';
import { InteractionError } from '../tools/errors.ts';
import { getActiveLeagueGame } from './game.service.ts';
import lodash from 'lodash';
import { type Balance } from '../database/models/balance.model.ts';

export async function placeUserBet(balance: Balance, amount: number, game?: SteveGame) {
    if (balance.amount >= amount) {
        const { gameId } = await findInprogressGame();
        let gameStartTime = game?.gameStart;
        if (!gameStartTime) {
            const leagueGame = await getActiveLeagueGame();
            gameStartTime = leagueGame?.gameStartTime;
        }
        const betOdds = getBetOdds(gameStartTime);

        const bet = await createBet({
            userId: balance.userId,
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

export function getUserProfit(bets: Pick<Bet, 'amount' | 'odds' | 'result' | 'guess'>[]) {
    let profit = 0;
    bets.forEach((bet) => {
        if (bet.result !== BetResult.IN_PROGRESS) {
            const change = bet.amount * bet.odds - bet.amount;
            if (bet.guess === bet.result) {
                profit += change;
            } else {
                profit -= bet.amount;
            }
        }
    });
    return lodash.round(profit, 2);
}

export async function updateBetOdds(userId: string, gameId: string, odds: number) {
    const updatedBet = await db<Bet>('bets').where({ userId, gameId }).update({ odds });
    return updatedBet;
}

export async function updateBetAmount(userId: string, gameId: string, amount: number) {
    const updatedBet = await db<Bet>('bets').where({ userId, gameId }).update({ amount });
    return updatedBet;
}
