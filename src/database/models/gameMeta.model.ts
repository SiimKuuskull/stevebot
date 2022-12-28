import { RiotActiveGame } from '../../services/riot-games/requests';

export type GameMeta = {
    createdAt: Date;
    id: number;
    meta: RiotActiveGame;
    steveGameId: number;
    updatedAt: Date;
};
