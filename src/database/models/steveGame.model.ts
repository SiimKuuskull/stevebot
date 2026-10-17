export type SteveGame = {
    createdAt: Date;
    id: number;
    gameId: string;
    gameStart: number;
    gameEnd: number;
    gameStatus: SteveGameStatus;
    gameResult: boolean;
};

export enum SteveGameStatus {
    COMPLETED = 'COMPLETED',
    VOID = 'VOID',
    IN_PROGRESS = 'IN PROGRESS',
}
