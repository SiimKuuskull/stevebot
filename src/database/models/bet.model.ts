export type Bet = {
    amount: number;
    guess: string;
    result: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    gameId: number;
};
