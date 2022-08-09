import { httpGet } from '../../tools/fetch';

const RIOT_API_EUNE_URL = 'https://eun1.api.riotgames.com';
const RIOT_API_EU_URL = 'https://europe.api.riotgames.com';

const DEV_API_TOKEN = 'RGAPI-32e1a25f-449a-4972-80aa-b95883acbd56'; // Mine tee rioti dev portaalil oma developer token

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requestFromRiot<T = any>(url: string, query?) {
    return httpGet(url, query, { 'X-Riot-Token': DEV_API_TOKEN }) as Promise<T>;
}

export function getActivegameBySummonerId(summonerId: string) {
    return requestFromRiot<RiotActiveGameResponse>(
        `${RIOT_API_EUNE_URL}/lol/spectator/v4/active-games/by-summoner/${summonerId}`,
    );
}

export function getMatchById(id: string) {
    return requestFromRiot<RiotMatchResponse>(`${RIOT_API_EU_URL}/lol/match/v5/matches/${id}`);
}

export async function getLatestUserMatchIds(puuid: string) {
    return requestFromRiot<string[]>(`${RIOT_API_EU_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids`);
}

export async function getRiotUserBySummonerName(summonerName: string) {
    return requestFromRiot<RiotUserProfile>(`${RIOT_API_EUNE_URL}/lol/summoner/v4/summoners/by-name/${summonerName}`);
}

type RiotActiveGameResponse = {
    gameId: number;
    mapId: number;
    gameMode: string;
    gameType: string;
    gameQueueConfigId: number;
    participants: ActiveGameParticipant[];
    observers: {
        encryptionKey: string;
    };
    platformId: 'EUN1';
    bannedChampions: BannedChampion[];
    gameStartTime: number;
    gameLength: number;
};

type RiotMatchResponse = {
    metadata: {
        dataVersion: string;
        matchId: string;
        participants: string[];
    };
    info: {
        gameCreation: number;
        gameDuration: number;
        gameEndTimeStamp: number;
        gameId: number;
        gameMode: string;
        gameName: string;
        gameStartTimestamp: number;
        gameType: string;
        gameVersion: string;
        mapId: number;
        participants: MatchParticipant[];
        platformId: 'EUN1';
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

type RiotUserProfile = {
    id: string;
    accountId: string;
    puuid: string;
    name: string;
    profileIconId: number;
    revisionDate: number;
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
    summonerId: string;
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
    summonerId: string;
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
