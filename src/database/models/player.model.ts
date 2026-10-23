import { type RiotPlatform } from '../../services/riot-games/requests.ts';

export type Player = {
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
