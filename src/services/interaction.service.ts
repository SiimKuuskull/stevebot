import { BET_ODDS } from '../database/models/bet.model.ts';

export enum Interaction {
    GAME_SELECTED = 'GAME_SELECTED',
    AMOUNT_SELECTED = 'AMOUNT_SELECTED',
    AMOUNT_SELECTED_CUSTOM = 'AMOUNT_SELECTED_CUSTOM',
    BANKRUPTCY_DECLARED = 'BANKRUPTCY_DECLARED',
    BANKRUPTCY_DENIED = 'BANKRUPTCY_DENIED',
    BET_LOSE = 'BET_LOSE',
    BET_WIN = 'BET_WIN',
    BET_CANCEL = 'BET_CANCEL',
}

const QUOTABLE_ODDS = Object.values(BET_ODDS).map(String);

export const BETTING_ACTIONS = [
    Interaction.AMOUNT_SELECTED,
    Interaction.AMOUNT_SELECTED_CUSTOM,
    Interaction.BET_WIN,
    Interaction.BET_LOSE,
    Interaction.BET_CANCEL,
] as const;

export type BettingAction = (typeof BETTING_ACTIONS)[number];
export type BetReference = { steveGameId: number; betId: number };

export function parseDatabaseId(value: unknown) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        return;
    }
    const id = Number(value);
    return Number.isSafeInteger(id) && id <= 2147483647 ? id : undefined;
}

export function bettingCustomId(action: BettingAction, reference: BetReference, odds?: number) {
    const id = `${action}:${reference.steveGameId}:${reference.betId}`;
    return odds === undefined ? id : `${id}:${odds}`;
}

export function parseBettingCustomId(value: unknown) {
    if (typeof value !== 'string') {
        return;
    }
    const [action, game, bet, quote, ...extra] = value.split(':');
    if (!BETTING_ACTIONS.includes(action as BettingAction) || extra.length) {
        return;
    }
    const steveGameId = parseDatabaseId(game);
    const betId = parseDatabaseId(bet);
    const confirms = action === Interaction.BET_WIN || action === Interaction.BET_LOSE;
    if (!steveGameId || !betId || (confirms ? !QUOTABLE_ODDS.includes(quote) : quote !== undefined)) {
        return;
    }
    return { action: action as BettingAction, steveGameId, betId, odds: confirms ? Number(quote) : undefined };
}
