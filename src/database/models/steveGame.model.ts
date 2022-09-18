export type SteveGame = {
    createdAt: Date;
    id: number;
    gameId: string;
    gameStart: number;
    gameLength: number;
    gameStatus: SteveGameStatus;
    gameResult: boolean;
};

export enum SteveGameStatus {
    COMPLETED = 'COMPLETED',
    IN_PROGRESS = 'IN PROGRESS',
}
