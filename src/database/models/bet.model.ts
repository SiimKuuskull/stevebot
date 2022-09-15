export type Bet = {
    userId: string;
    userName: string;
    amount: number;
    gameId: number;
    guess: boolean;
    result: boolean;
    createdAt: Date;
    updatedAt: Date;
};
