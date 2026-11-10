import { type RiotPlatform } from '../../services/riot-games/requests.ts';

export const MAX_TRACKED_PLAYERS = 3;

export type Player = {
    id: number;
    puuid: string;
    //summonerId: string;
    //accountId: string;
    gameName: string;
    tagLine: string;
    platformId: RiotPlatform;
    createdAt: Date;
    isTracked: boolean;
    updatedAt: Date;
};
