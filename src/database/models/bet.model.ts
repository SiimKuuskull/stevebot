export type Bet = {
    id: number;
    userId: string;
    amount: number;
    steveGameId: number;
    guess: BetResult;
    result: BetResult;
    odds: number;
    createdAt: Date;
    updatedAt: Date;
    gameStart: number;
};

export const BET_ODDS = { opening: 2, early: 1.6, late: 1.4, final: 1.1 } as const;

export enum BetResult {
    IN_PROGRESS = 'IN PROGRESS',
    WIN = 'WIN',
    LOSE = 'LOSE',
    VOID = 'VOID',
}
