import { DateTime } from 'luxon';
import lodash from 'lodash';
import { type Knex } from 'knex';
import { db } from '../database/db.ts';
import { type Bet, BetResult } from '../database/models/bet.model.ts';
import { type Player } from '../database/models/player.model.ts';
import { type SteveGame, SteveGameStatus } from '../database/models/steveGame.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { findPlayerById, findTrackedPlayers } from '../database/queries/player.query.ts';
import { findSteveGameById, findSteveGameByMatch } from '../database/queries/steveGames.query.ts';
import { createTransaction } from '../database/queries/transactions.query.ts';
import { InteractionError } from '../tools/errors.ts';
import { log, LoggerType } from '../tools/logger.ts';
import { getActiveLeagueGame, getLatestFinishedMatchId } from './game.service.ts';
import { type BetReference } from './interaction.service.ts';
import { addPlatformToMatchId } from './riot-games/requests.ts';

export const EXPIRED_BET_MESSAGE = 'See panustamise valik on aegunud. Alusta uuesti käsuga /place-bet.';
export const BET_WINDOW_MS = 24 * 60 * 1000;
export const DRAFT_LIFETIME_MS = 60 * 1000;
export type BettingGame = { game: SteveGame; player: Player; startTime: number };

function expired(): never {
    throw new InteractionError(EXPIRED_BET_MESSAGE);
}

function assertOpenGame(game: SteveGame | undefined, player: Player | undefined) {
    if (
        !game ||
        !player ||
        game.gameStatus !== SteveGameStatus.IN_PROGRESS ||
        !player.isTracked ||
        game.playerId !== player.id ||
        game.platformId !== player.platformId
    ) {
        expired();
    }
}

function assertBettingWindow(startTime: number) {
    if (!Number.isFinite(startTime) || startTime <= 0 || Date.now() - startTime >= BET_WINDOW_MS) {
        throw new InteractionError('Mäng on kestnud liiga kaua, et panustada. Oota järgmist mängu!');
    }
}

function assertDraft(bet: Bet | undefined): asserts bet is Bet {
    if (
        !bet ||
        bet.guess !== BetResult.IN_PROGRESS ||
        bet.result !== BetResult.IN_PROGRESS ||
        Date.now() - bet.createdAt.getTime() >= DRAFT_LIFETIME_MS
    ) {
        expired();
    }
}

async function checkLiveGame(game: SteveGame, player: Player): Promise<BettingGame> {
    assertOpenGame(game, player);
    const active = await getActiveLeagueGame(player);
    if (!active || String(active.gameId) !== game.gameId || active.platformId !== game.platformId) {
        expired();
    }
    if ((await getLatestFinishedMatchId(player.puuid)) === addPlatformToMatchId(game.platformId, game.gameId)) {
        expired();
    }
    const startTime = active.gameStartTime || game.createdAt.getTime();
    assertBettingWindow(startTime);
    return { game, player, startTime };
}

export async function loadBettingGame(steveGameId: number): Promise<BettingGame> {
    const game = await findSteveGameById(steveGameId);
    if (!game || game.playerId == null) {
        expired();
    }
    const player = await findPlayerById(game.playerId);
    if (!player) {
        expired();
    }
    return checkLiveGame(game, player);
}

export async function findAvailableBettingGames(userId: string) {
    const pendingGames = await db('steve_games').where({ gameStatus: SteveGameStatus.IN_PROGRESS });
    const players = (await findTrackedPlayers()).filter((player) =>
        pendingGames.some((game) => game.playerId === player.id),
    );
    const results = await Promise.allSettled(
        players.map(async (player) => {
            const active = await getActiveLeagueGame(player);
            if (!active) {
                return;
            }
            const game = await findSteveGameByMatch({
                playerId: player.id,
                platformId: active.platformId,
                gameId: String(active.gameId),
            });
            if (!game || game.gameStatus !== SteveGameStatus.IN_PROGRESS || game.platformId !== player.platformId) {
                return;
            }
            const startTime = active.gameStartTime || game.createdAt.getTime();
            if (!Number.isFinite(startTime) || startTime <= 0 || Date.now() - startTime >= BET_WINDOW_MS) {
                return;
            }
            const finished = await getLatestFinishedMatchId(player.puuid);
            if (finished === addPlatformToMatchId(game.platformId, game.gameId)) {
                return;
            }
            const existing = await db('bets')
                .where({ userId, steveGameId: game.id })
                .where((query) => {
                    query.whereNot({ guess: BetResult.IN_PROGRESS }).orWhereNot({ result: BetResult.IN_PROGRESS });
                })
                .first();
            if (existing) {
                return;
            }
            return { game, player, startTime };
        }),
    );
    const available: BettingGame[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            available.push(result.value);
        }
        if (result.status === 'rejected') {
            log(result.reason, LoggerType.ERROR);
        }
    }
    if (!available.length && results.some((result) => result.status === 'rejected')) {
        throw new InteractionError('Mängude kontroll ebaõnnestus. Palun proovi hiljem uuesti.');
    }
    return available;
}

async function lockBettingGame(context: BettingGame, trx: Knex.Transaction) {
    const game = await trx('steve_games').where({ id: context.game.id }).first().forUpdate();
    const player = await trx('player').where({ id: context.player.id }).first().forShare();
    assertOpenGame(game, player);
    if (
        game?.gameId !== context.game.gameId ||
        game?.platformId !== context.game.platformId ||
        player?.puuid !== context.player.puuid
    ) {
        expired();
    }
    assertBettingWindow(context.startTime);
}

export async function startBettingDraft(userId: string, context: BettingGame) {
    return db.transaction(async (trx) => {
        await lockBettingGame(context, trx);
        const existing = await trx('bets').where({ userId, steveGameId: context.game.id });
        if (existing.some((bet) => bet.guess !== BetResult.IN_PROGRESS || bet.result !== BetResult.IN_PROGRESS)) {
            throw new InteractionError('Oled sellele mängijale selles mängus juba panuse teinud.');
        }
        await trx('bets')
            .where({
                userId,
                steveGameId: context.game.id,
                guess: BetResult.IN_PROGRESS,
                result: BetResult.IN_PROGRESS,
            })
            .del();
        const [bet] = await trx('bets')
            .insert({
                userId,
                steveGameId: context.game.id,
                amount: 0,
                odds: getBetOdds(context.startTime),
                guess: BetResult.IN_PROGRESS,
                result: BetResult.IN_PROGRESS,
            })
            .returning('*');
        return bet;
    });
}

export async function loadBettingDraft(userId: string, reference: BetReference, checkRiot = true) {
    const bet = await db('bets').where({ id: reference.betId, steveGameId: reference.steveGameId, userId }).first();
    assertDraft(bet);
    if (checkRiot) {
        return { bet, context: await loadBettingGame(reference.steveGameId) };
    }
    // Opening a modal must acknowledge the interaction immediately; submission rechecks Riot.
    const game = await findSteveGameById(reference.steveGameId);
    if (!game || game.playerId == null) {
        expired();
    }
    const player = await findPlayerById(game.playerId);
    if (!player) {
        expired();
    }
    assertOpenGame(game, player);
    return { bet, context: { game, player, startTime: game.gameStart || game.createdAt.getTime() } };
}

export function parseBetAmount(value: unknown) {
    if (typeof value !== 'string' || !/^\d{1,6}$/.test(value)) {
        throw new InteractionError('Sisesta täisarv vahemikus 1–100 000.');
    }
    const amount = Number(value);
    if (amount < 1 || amount > 100000) {
        throw new InteractionError('Sisesta täisarv vahemikus 1–100 000.');
    }
    return amount;
}

export async function selectBetAmount(userId: string, reference: BetReference, amount: number, context: BettingGame) {
    parseBetAmount(String(amount));
    return db.transaction(async (trx) => {
        await lockBettingGame(context, trx);
        const bet = await trx('bets')
            .where({ id: reference.betId, steveGameId: reference.steveGameId, userId })
            .first()
            .forUpdate();
        assertDraft(bet);
        if (bet.steveGameId !== context.game.id || bet.amount !== 0) {
            expired();
        }
        const balance = await trx('balance').where({ userId }).first();
        if (!balance || balance.amount < amount) {
            throw new InteractionError('Sul pole piisavalt münte selle panuse jaoks.');
        }
        await getAllowedBetGuesses(userId, context, trx);
        const [updated] = await trx('bets')
            .where({ id: bet.id })
            .update({ amount, odds: getBetOdds(context.startTime) })
            .returning('*');
        return updated;
    });
}

export async function getAllowedBetGuesses(userId: string, context: BettingGame, query = db) {
    const user = await query('users').where({ id: userId }).first();
    const meta = await query('game_meta').where({ steveGameId: context.game.id }).first();
    const owner = meta?.meta.participants.find((participant) => participant.puuid === context.player.puuid);
    if (!user || !owner) {
        throw new InteractionError('Mängijate andmed pole saadaval. Palun proovi hiljem uuesti.');
    }
    const bettor = meta?.meta.participants.find((participant) => participant.puuid === user.puuid);
    return { win: !bettor || bettor.teamId === owner.teamId, lose: !bettor || bettor.teamId !== owner.teamId };
}

export async function confirmBet(
    userId: string,
    reference: BetReference,
    guess: BetResult.WIN | BetResult.LOSE,
    quotedOdds: number,
    context: BettingGame,
) {
    return db.transaction(async (trx) => {
        await lockBettingGame(context, trx);
        const bet = await trx('bets')
            .where({ id: reference.betId, steveGameId: reference.steveGameId, userId })
            .first()
            .forUpdate();
        assertDraft(bet);
        if (bet.steveGameId !== context.game.id) {
            expired();
        }
        parseBetAmount(String(bet.amount));
        const allowed = await getAllowedBetGuesses(userId, context, trx);
        if (!(guess === BetResult.WIN ? allowed.win : allowed.lose)) {
            throw new InteractionError('Sa ei saa oma meeskonna vastu panustada.');
        }
        await trx('balance').where({ userId }).first().forUpdate();
        assertDraft(bet);
        assertBettingWindow(context.startTime);
        const odds = getBetOdds(context.startTime);
        if (odds !== quotedOdds || bet.odds !== odds) {
            const [updated] = await trx('bets').where({ id: bet.id }).update({ odds }).returning('*');
            return { confirmed: false, bet: updated };
        }
        const [balance] = await trx('balance')
            .where({ userId })
            .where('amount', '>=', bet.amount)
            .decrement('amount', bet.amount)
            .returning('*');
        if (!balance) {
            throw new InteractionError('Sul pole piisavalt münte selle panuse jaoks.');
        }
        const [updated] = await trx('bets').where({ id: bet.id }).update({ guess }).returning('*');
        await createTransaction(
            {
                userId,
                amount: -bet.amount,
                balance: balance.amount,
                externalTransactionId: bet.id,
                type: TransactionType.BET_PLACED,
            },
            trx,
        );
        return { confirmed: true, bet: updated };
    });
}

export async function cancelBettingDraft(userId: string, reference: BetReference) {
    const removed = await db('bets')
        .where({
            id: reference.betId,
            steveGameId: reference.steveGameId,
            userId,
            guess: BetResult.IN_PROGRESS,
            result: BetResult.IN_PROGRESS,
        })
        .del();
    if (!removed) {
        expired();
    }
}

export function getBetOdds(startTime: number) {
    const beginTime = DateTime.fromISO(new Date(startTime).toISOString());
    const realTime = DateTime.fromISO(new Date().toISOString());
    const { minutes: gameLengthMinutes = 0 } = realTime.diff(beginTime, 'minutes').toObject();
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
        if (bet.result === BetResult.WIN || bet.result === BetResult.LOSE) {
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
