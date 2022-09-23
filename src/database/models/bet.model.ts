export type Bet = {
    userId: string;
    userName: string;
    amount: number;
    gameId: string;
    guess: boolean;
    result: boolean;
    odds: number;
    createdAt: Date;
    updatedAt: Date;
    gameStart: number;
};
