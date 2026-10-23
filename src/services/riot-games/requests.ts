import { RiotRequestError } from '../../tools/errors.ts';
import { httpGet } from '../../tools/fetch.ts';

export const RIOT_PLATFORMS = ['EUN1', 'EUW1', 'NA1'] as const;
export type RiotPlatform = (typeof RIOT_PLATFORMS)[number];

export const RIOT_PLATFORM_URLS: Record<RiotPlatform, string> = {
    EUN1: 'https://eun1.api.riotgames.com',
    EUW1: 'https://euw1.api.riotgames.com',
    NA1: 'https://na1.api.riotgames.com',
};
export const RIOT_API_EU_URL = 'https://europe.api.riotgames.com';

export function isRiotPlatform(value: string): value is RiotPlatform {
    return (RIOT_PLATFORMS as readonly string[]).includes(value);
}

export function toGameId(matchId: string) {
    return matchId.slice(matchId.indexOf('_') + 1);
}

async function requestFromRiot<T = any>(url: string, query?: Record<string, string>) {
    const { status, body } = await httpGet(url, query, { 'X-Riot-Token': process.env.RIOT_API_TOKEN });
    if (status === 400) {
        return;
    }
    if (status >= 400) {
        const message = body?.status?.message ?? body?.message ?? 'Unknown error';
        throw new RiotRequestError(`Riot API ${status}: ${message}`, status);
    }
    return body as T;
}

export function getRiotUserByRiotId(gameName: string, tagLine: string) {
    return requestFromRiot<RiotUserProfileByAccountV1>(
        `${RIOT_API_EU_URL}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    );
}
export function getRiotUserByPuuId(puuid: string, platform: RiotPlatform) {
    return requestFromRiot<RiotUserProfileBySummonerV4>(
        `${RIOT_PLATFORM_URLS[platform]}/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    );
}
export function getRiotUserByAccountId(accountId: string, platform: RiotPlatform) {
    return requestFromRiot<RiotUserProfileBySummonerV4>(
        `${RIOT_PLATFORM_URLS[platform]}/lol/summoner/v4/summoners/by-account/${accountId}`,
    );
}

export function getActivegameByPuuId(puuid: string, platform: RiotPlatform) {
    return requestFromRiot<RiotActiveGame>(
        `${RIOT_PLATFORM_URLS[platform]}/lol/spectator/v5/active-games/by-summoner/${puuid}`,
    );
}

export function getMatchById(id: string) {
    return requestFromRiot<RiotMatchResponse>(`${RIOT_API_EU_URL}/lol/match/v5/matches/${id}`);
}

export async function getLatestUserMatchIds(puuid: string) {
    return requestFromRiot<string[]>(`${RIOT_API_EU_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids`) as Promise<
        string[]
    >;
}

/* export async function getRiotUserRankedEntries(summonerId: string, platform: RiotPlatform) {
    return requestFromRiot(`${RIOT_PLATFORM_URLS[platform]}/lol/league/v4/entries/by-summoner/${summonerId}`);
} */

export type RiotActiveGame = {
    gameId: number;
    mapId: number;
    gameMode: string;
    gameType: string;
    gameQueueConfigId: number;
    participants: ActiveGameParticipant[];
    observers: {
        encryptionKey: string;
    };
    platformId: RiotPlatform;
    bannedChampions: BannedChampion[];
    gameStartTime: number;
    gameLength: number;
};

export type RiotMatchResponse = {
    metadata: {
        dataVersion: string;
        matchId: string;
        participants: string[];
    };
    info: {
        gameCreation: number;
        gameDuration: number;
        gameEndTimestamp: number;
        gameId: string;
        gameMode: string;
        gameName: string;
        gameStartTimestamp: number;
        gameType: string;
        gameVersion: string;
        mapId: number;
        participants: MatchParticipant[];
        platformId: RiotPlatform;
        queueId: number;
        teams: {
            bans: { championId: number; pickTurn: number }[];
            objectives: {
                baron: CountStat;
                champion: CountStat;
                dragon: CountStat;
                inhibitor: CountStat;
                riftHerald: CountStat;
                tower: CountStat;
            };
            teamId: number;
            win: boolean;
        }[];
        tournamentCode: string;
    };
};

type CountStat = { first: boolean; kills: number };

type RiotUserProfileByAccountV1 = {
    puuid: string;
    gameName: string;
    tagLine: string;
};
type RiotUserProfileBySummonerV4 = {
    id: string;
    accountId: string;
    puuid: string;
    profileIconId: number;
    summonerLevel: number;
};
type BannedChampion = {
    championId: number;
    teamId: number;
    pickTurn: number;
};
type ActiveGameParticipant = {
    teamId: number;
    spell1Id: number;
    spell2Id: number;
    championId: number;
    profileIcon: number;
    summonerName: string;
    bot: boolean;
    puuid: string;
    gameCustomizationObjects: unknown[];
    perks: {
        perkIds: number[];
        perkStyle: number;
        perkSubStyle: number;
    };
};

type MatchParticipant = {
    assists: number;
    baronKills: number;
    bountyLevel: number;
    challenges: Record<string, number>;
    champExperience: number;
    champLevel: number;
    championId: number;
    championName: string;
    championTransform: number;
    consumablesPurchased: number;
    damageDealtToBuildings: number;
    damageDealtToObjectives: number;
    damageDealtToTurrets: number;
    damageSelfMitigated: number;
    deaths: number;
    detectorWardsPlaced: number;
    doubleKills: number;
    dragonKills: number;
    eligibleForProgression: boolean;
    firstBloodAssist: boolean;
    firstBloodKill: boolean;
    firstTowerAssist: boolean;
    firstTowerKill: boolean;
    gameEndedInEarlySurrender: boolean;
    gameEndedInSurrender: boolean;
    goldEarned: number;
    goldSpent: number;
    individualPosition: string;
    inhibitorKills: number;
    inhibitorTakedowns: number;
    inhibitorsLost: number;
    item0: number;
    item1: number;
    item2: number;
    item3: number;
    item4: number;
    item5: number;
    item6: number;
    itemsPurchased: number;
    killingSprees: number;
    kills: number;
    lane: string;
    largestCriticalStrike: number;
    largestKillingSpree: number;
    largestMultikill: number;
    longestTimeSpentLiving: number;
    magicDamageDealt: number;
    magicDamageDealtToChampions: number;
    magicDamageTaken: number;
    neutralMinionsKilled: number;
    nexusKills: number;
    nexusLost: number;
    nexusTakedowns: number;
    objectivesStolen: number;
    objectivesStolenAssists: number;
    participantId: number;
    pentaKills: number;
    perks: {
        statPerks: {
            defense: number;
            flex: number;
            offense: number;
        };
        styles: {
            description: string;
            selections: {
                perk: number;
                var1: number;
                var2: number;
                var3: number;
            }[];
            style: number;
        }[];
    };
    physicalDamageDealt: number;
    physicalDamageDealtToChampions: number;
    physicalDamageTaken: number;
    profileIcon: number;
    puuid: string;
    quadraKills: number;
    riotIdName: string;
    riotIdTagline: string;
    role: string;
    sightWardsBoughtInGame: number;
    spell1Casts: number;
    spell2Casts: number;
    spell3Casts: number;
    spell4Casts: number;
    summoner1Casts: number;
    summoner1Id: number;
    summoner2Casts: number;
    summoner2Id: number;
    PuuId: string;
    summonerLevel: number;
    summonerName: string;
    teamEarlySurrendered: number;
    teamId: number;
    teamPosition: string;
    timeCCingOthers: number;
    timePlayed: number;
    totalDamageDealt: number;
    totalDamageDealtToChampions: number;
    totalDamageShieldedOnTeammates: number;
    totalDamageTaken: number;
    totalHeal: number;
    totalHealsOnTeammates: number;
    totalMinionsKilled: number;
    totalTimeCCDealt: number;
    totalTimeSpentDead: number;
    totalUnitsHealed: number;
    tripleKills: number;
    trueDamageDealt: number;
    trueDamageDealtToChampions: number;
    trueDamageTaken: number;
    turretKills: number;
    turretTakedowns: number;
    turretsLost: number;
    unrealKills: number;
    visionScore: number;
    visionWardsBoughtInGame: number;
    wardsKilled: number;
    wardsPlaced: number;
    win: boolean;
};
