export type Bet = {
    id: number;
    userId: string;
    userName: string;
    amount: number;
    gameId: string;
    guess: BetGuess;
    result: BetResult;
    odds: number;
    createdAt: Date;
    updatedAt: Date;
    gameStart: number;
};

export enum BetGuess {
    IN_PROGRESS = 'IN PROGRESS',
    WIN = 'WIN',
    LOSE = 'LOSE',
}
export enum BetResult {
    IN_PROGRESS = 'IN PROGRESS',
    WIN = 'WIN',
    LOSE = 'LOSE',
}
