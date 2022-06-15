import { httpGet } from '../tools/fetch';

const RIOT_API_EUNE_URL = 'https://eun1.api.riotgames.com';
const RIOT_API_EU_URL = 'https://europe.api.riotgames.com';

const DEV_API_TOKEN = 'RGAPI-b3e55e0c-aa72-4e54-9374-04ddf743e5cb'; // Mine tee rioti dev portaalil oma developer token

function requestFromRiot<T = any>(url: string, query?) {
    return httpGet(url, query, { 'X-Riot-Token': DEV_API_TOKEN }) as Promise<T>;
}

export function getMatchById(id: string) {
    return requestFromRiot<{ metadata: any; info: any }>(`${RIOT_API_EU_URL}/lol/match/v5/matches/${id}`);
}

export async function getLatestUserMatchIds(puuid: string) {
    return requestFromRiot<string[]>(`${RIOT_API_EU_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids`);
}

export async function getRiotUserBySummonerName(summonerName: string) {
    return requestFromRiot<RiotUserProfile>(`${RIOT_API_EUNE_URL}/lol/summoner/v4/summoners/by-name/${summonerName}`);
}

type RiotUserProfile = {
    id: string;
    accountId: string;
    puuid: string;
    name: string;
    profileIconId: number;
    revisionDate: number;
    summonerLevel: number;
};
