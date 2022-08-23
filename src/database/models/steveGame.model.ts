export type SteveGame = {
    createdAt: Date;
    id: number;
    gameId: number;
    gameLength: number;
    gameStatus: SteveGameStatus;
};

export enum SteveGameStatus {
    COMPLETED = 'COMPLETED',
    IN_PROGRESS = 'IN PROGRESS',
}
