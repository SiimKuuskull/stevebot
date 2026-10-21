import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type Bet, BetResult } from '../models/bet.model.ts';
import { type GameMeta } from '../models/gameMeta.model.ts';

export async function createBet(template: Partial<Bet>) {
    const [bet] = await db('bets').insert(template).returning('*');
    log(`Created bet ${bet.id}`);
    return bet;
}
export async function updateBetAmount(userId: string, gameId: string, amount: number) {
    return db('bets').where({ userId, gameId }).update({ amount });
}

export async function updateBetOdds(userId: string, gameId: string, odds: number) {
    return db('bets').where({ userId, gameId }).update({ odds });
}

export async function placeUserBetDecision(userId: string, guess: BetResult, gameId: string) {
    await db('bets').where({ userId, gameId }).update({ guess });
    const betDecision = await db('bets').where({ userId, gameId }).first();
    log(`Bet updated by ${userId} choosing ${betDecision?.guess}`);
    return betDecision;
}
export async function resultBetsByGameId(gameId: string, update: Partial<Bet>) {
    await db('bets').where({ gameId, result: BetResult.IN_PROGRESS }).update(update);
}

export function refundableBetsQuery(gameId: string) {
    return db('bets')
        .where({ gameId, result: BetResult.IN_PROGRESS })
        .whereIn('guess', [BetResult.WIN, BetResult.LOSE]);
}

export async function findRefundableBets(gameId: string) {
    return refundableBetsQuery(gameId);
}

export async function voidInProgressBet(betId: number, knexTrx = db) {
    const [bet] = await knexTrx('bets')
        .where({ id: betId, result: BetResult.IN_PROGRESS })
        .update({ result: BetResult.VOID })
        .returning('*');
    return bet;
}

export async function findUserBetDecision(userId: string, gameId: string) {
    const [betDecision] = await db('bets').where({ userId, gameId });
    log(`User ${userId} bet ${betDecision?.amount} on Steve ${betDecision?.guess}`);
    return betDecision;
}

export async function findUserExistingBet(userId: string, gameId: string) {
    const bet = await db('bets').where({ userId, gameId }).first();
    if (bet) {
        log(`User ${userId} bet ${bet?.amount} on Steve ${bet?.guess} the game ID: ${bet?.gameId}`);
    }
    return bet;
}

export async function findUserBetOdds(userId: string, gameId: string) {
    const [bet] = await db('bets').where({ userId, gameId });
    return bet?.odds;
}

export async function findTopBet(gameId: string) {
    return db('bets').where('gameId', gameId).orderBy('amount', 'desc');
}

export async function findUserInProgressBet(userId: string) {
    return db('bets').where({ userId, result: BetResult.IN_PROGRESS }).first();
}
export async function findInProgressGuess(userId: string) {
    return db('bets').where({ userId, guess: BetResult.IN_PROGRESS }).first();
}

export async function deleteinProgressBet(userId: string, guess: BetResult) {
    log('Deleted a IN PROGRESS bet ');
    return db('bets').where({ userId, guess }).whereNot({ result: BetResult.VOID }).del();
}

export async function deleteinProgressBetbyGameId(userId: string, gameId: string) {
    log('Deleted a IN PROGRESS bet ');
    return db('bets').where({ userId, gameId }).whereNot({ result: BetResult.VOID }).del();
}

export async function findActiveGameBets(activeGameId: string) {
    const activeBets = await db('bets').where('gameId', activeGameId);
    if (!activeBets.length) {
        log(`No active bets for the game: ${activeGameId} `);
        return;
    }
    return activeBets;
}

export async function deleteIncompleteBets(gameId: string) {
    log('Deleting incomplete bets');
    return db('bets').where({ gameId, guess: BetResult.IN_PROGRESS }).whereNot({ result: BetResult.VOID }).del();
}

export async function updateBet(id: number, update: Partial<Bet>) {
    await db('bets').where('id', id).update(update);
}

export async function getAllResultedBets() {
    return db('bets')
        .whereNot({ guess: BetResult.IN_PROGRESS })
        .whereIn('result', [BetResult.WIN, BetResult.LOSE])
        .select(['userId', 'amount', 'guess', 'result']);
}

export async function getUserBets(userId: string) {
    const bets = await db('bets').select().where('userId', userId).andWhereNot({ result: BetResult.IN_PROGRESS });
    return bets;
}

export async function getUserPendingBets(userId: string): Promise<(Bet & { meta: GameMeta['meta'] | null })[]> {
    return db('bets')
        .leftJoin('steve_games', 'steve_games.gameId', 'bets.gameId')
        .leftJoin('game_meta', 'game_meta.steveGameId', 'steve_games.id')
        .where('bets.userId', userId)
        .where('bets.result', BetResult.IN_PROGRESS)
        .whereIn('guess', [BetResult.WIN, BetResult.LOSE])
        .select('bets.*', 'game_meta.meta');
}

export type BetWinLossCount = {
    betWins: { user_id: string; count: string }[];
    betLosses: { user_id: string; count: string }[];
};

export async function getBetsWinLossCount(): Promise<BetWinLossCount> {
    const { rows: betWins } = await db.raw<{ rows: { user_id: string; count: string }[] }>(
        `SELECT user_id, COUNT(*) FROM bets WHERE guess = result AND result IN ('WIN', 'LOSE') GROUP BY user_id`,
    );
    const { rows: betLosses } = await db.raw<{ rows: { user_id: string; count: string }[] }>(
        `SELECT user_id, COUNT(*) FROM bets WHERE guess != result AND result IN ('WIN', 'LOSE') GROUP BY user_id;`,
    );
    return { betWins, betLosses };
}
