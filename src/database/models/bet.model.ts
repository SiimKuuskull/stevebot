export type Bet = {
    id: number;
    userId: string;
    amount: number;
    gameId: string;
    guess: BetResult;
    result: BetResult;
    odds: number;
    createdAt: Date;
    updatedAt: Date;
    gameStart: number;
};

export enum BetResult {
    IN_PROGRESS = 'IN PROGRESS',
    WIN = 'WIN',
    LOSE = 'LOSE',
}
