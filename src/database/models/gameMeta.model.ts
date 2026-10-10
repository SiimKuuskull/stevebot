import { type RiotActiveGame } from '../../services/riot-games/requests.ts';

export type GameMeta = {
    createdAt: Date;
    id: number;
    meta: RiotActiveGame;
    steveGameId: number;
    updatedAt: Date;
};
