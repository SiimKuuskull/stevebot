import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type Bet, BetResult } from '../models/bet.model.ts';
import { type RiotPlatform } from '../../services/riot-games/requests.ts';

export async function createBet(template: Partial<Bet> & { steveGameId: number }) {
    if (template.steveGameId == null) {
        throw new Error('A Steve game ID is required to create a bet');
    }
    const [bet] = await db('bets').insert(template).returning('*');
    log(`Created bet ${bet.id}`);
    return bet;
}
export async function updateBetAmount(userId: string, steveGameId: number, amount: number) {
    return db('bets').where({ userId, steveGameId }).update({ amount });
}

export async function updateBetOdds(userId: string, steveGameId: number, odds: number) {
    return db('bets').where({ userId, steveGameId }).update({ odds });
}

export async function placeUserBetDecision(userId: string, guess: BetResult, steveGameId: number) {
    await db('bets').where({ userId, steveGameId }).update({ guess });
    const betDecision = await db('bets').where({ userId, steveGameId }).first();
    log(`Bet updated by ${userId} choosing ${betDecision?.guess}`);
    return betDecision;
}
export async function resultBetsBySteveGameId(steveGameId: number, update: Partial<Bet>) {
    await db('bets').where({ steveGameId, result: BetResult.IN_PROGRESS }).update(update);
}

export function refundableBetsQuery(steveGameId: number) {
    return db('bets')
        .where({ steveGameId, result: BetResult.IN_PROGRESS })
        .whereIn('guess', [BetResult.WIN, BetResult.LOSE]);
}

export async function findRefundableBets(steveGameId: number) {
    return refundableBetsQuery(steveGameId);
}

export async function voidInProgressBet(betId: number, knexTrx = db) {
    const [bet] = await knexTrx('bets')
        .where({ id: betId, result: BetResult.IN_PROGRESS })
        .update({ result: BetResult.VOID })
        .returning('*');
    return bet;
}

export async function findUserBetDecision(userId: string, steveGameId: number) {
    const [betDecision] = await db('bets').where({ userId, steveGameId });
    log(`User ${userId} bet ${betDecision?.amount} on Steve ${betDecision?.guess}`);
    return betDecision;
}

export async function findUserExistingBet(userId: string, steveGameId: number) {
    const bet = await db('bets').where({ userId, steveGameId }).first();
    if (bet) {
        log(`User ${userId} bet ${bet?.amount} on Steve ${bet?.guess} the game ID: ${bet?.steveGameId}`);
    }
    return bet;
}

export async function findUserBetOdds(userId: string, steveGameId: number) {
    const [bet] = await db('bets').where({ userId, steveGameId });
    return bet?.odds;
}

export async function findTopBet(steveGameId: number) {
    return db('bets').where('steveGameId', steveGameId).orderBy('amount', 'desc');
}

export async function findUserInProgressBet(userId: string) {
    return db('bets').where({ userId, result: BetResult.IN_PROGRESS }).first();
}

export type ActiveBetWithPlayer = Bet & {
    gameId: string;
    platformId: RiotPlatform;
    gameName: string | null;
    tagLine: string | null;
};

export function findUserInProgressBets(userId: string): Promise<ActiveBetWithPlayer[]> {
    return db('bets as b')
        .join('steve_games as g', 'g.id', 'b.steveGameId')
        .leftJoin('player as p', 'p.id', 'g.playerId')
        .where({ 'b.userId': userId, 'b.result': BetResult.IN_PROGRESS })
        .whereIn('b.guess', [BetResult.WIN, BetResult.LOSE])
        .select('b.*', 'g.gameId', 'g.platformId', 'p.gameName', 'p.tagLine')
        .orderBy('b.createdAt', 'desc')
        .orderBy('b.id', 'desc');
}

export function findUserConfirmedInProgressBet(userId: string, knexTrx = db) {
    return knexTrx('bets')
        .where({ userId, result: BetResult.IN_PROGRESS })
        .whereIn('guess', [BetResult.WIN, BetResult.LOSE])
        .first();
}
export async function findInProgressGuess(userId: string) {
    return db('bets').where({ userId, guess: BetResult.IN_PROGRESS }).first();
}

export async function deleteInProgressBet(userId: string, steveGameId: number) {
    return db('bets').where({ userId, steveGameId, guess: BetResult.IN_PROGRESS, result: BetResult.IN_PROGRESS }).del();
}

export async function findActiveGameBets(steveGameId: number) {
    const activeBets = await db('bets').where('steveGameId', steveGameId);
    if (!activeBets.length) {
        log(`No active bets for the game: ${steveGameId} `);
        return;
    }
    return activeBets;
}

export async function deleteIncompleteBets(steveGameId: number) {
    log('Deleting incomplete bets');
    return db('bets').where({ steveGameId, guess: BetResult.IN_PROGRESS }).whereNot({ result: BetResult.VOID }).del();
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
