import { type RiotPlatform } from '../../services/riot-games/requests.ts';

export type SteveGame = {
    createdAt: Date;
    id: number;
    gameId: string;
    platformId: RiotPlatform;
    gameStart: number;
    gameEnd: number;
    gameStatus: SteveGameStatus;
    gameResult: boolean;
};

export enum SteveGameStatus {
    COMPLETED = 'COMPLETED',
    IN_PROGRESS = 'IN PROGRESS',
    VOID = 'VOID',
}
