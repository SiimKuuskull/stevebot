export type Bet = {
    amount: number;
    guess: boolean;
    result: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    userName: string;
    gameId: number;
};
