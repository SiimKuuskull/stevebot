export type Bet = {
    userId: string;
    userName: string;
    amount: number;
    gameId: number;
    guess: boolean;
    result: boolean;
    odds: number;
    createdAt: Date;
    updatedAt: Date;
    game_start: number;
};
