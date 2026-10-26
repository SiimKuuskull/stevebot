import {
    activatePlayerTracking,
    createInitialTrackedPlayer,
    deactivatePlayerTracking,
    hasPlayers,
} from '../database/queries/player.query.ts';
import { MAX_TRACKED_PLAYERS } from '../database/models/player.model.ts';
import { InteractionError, RiotRequestError } from '../tools/errors.ts';
import { log, LoggerType } from '../tools/logger.ts';
import { getRiotUserByPuuId, getRiotUserByRiotId, RIOT_PLATFORMS, type RiotPlatform } from './riot-games/requests.ts';

export async function trackPlayer(riotId: string, region: string) {
    const parts = riotId.trim().split('#');
    const gameName = parts[0]?.trim();
    const tagLine = parts[1]?.trim();
    if (parts.length !== 2 || !gameName || !tagLine) {
        throw new InteractionError('Sisesta Riot ID kujul mängijanimi#tag.');
    }
    if (!RIOT_PLATFORMS.includes(region as RiotPlatform)) {
        throw new InteractionError('Vali regioon EUNE või EUW.');
    }
    const platformId = region as RiotPlatform;
    let account;
    try {
        account = await getRiotUserByRiotId(gameName, tagLine);
    } catch (error) {
        if (error instanceof RiotRequestError && error.statusCode === 404) {
            throw new InteractionError('Selle Riot ID-ga mängijat ei leitud.');
        }
        throw error;
    }
    if (!account?.puuid || !account.gameName || !account.tagLine) {
        throw new InteractionError('Selle Riot ID-ga mängijat ei leitud.');
    }
    let summoner;
    try {
        summoner = await getRiotUserByPuuId(account.puuid, platformId);
    } catch (error) {
        if (error instanceof RiotRequestError && error.statusCode === 404) {
            throw new InteractionError('Mängija LoL-i kontot valitud regioonis ei leitud. Kontrolli regiooni.');
        }
        throw error;
    }
    if (!summoner || summoner.puuid !== account.puuid) {
        throw new InteractionError('Mängija LoL-i kontot valitud regioonis ei leitud. Kontrolli regiooni.');
    }

    const result = await activatePlayerTracking({
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine,
        platformId,
    });
    if (!result) {
        throw new InteractionError(
            `Korraga saab jälgida kuni ${MAX_TRACKED_PLAYERS} mängijat. Eemalda esmalt üks käsuga /untrack-player.`,
        );
    }
    log(`Tracking ${result.player.gameName}#${result.player.tagLine}: ${result.status}`);
    return result;
}

export async function untrackPlayer(playerId: number) {
    const player = await deactivatePlayerTracking(playerId);
    if (!player) {
        throw new InteractionError('Seda mängijat praegu ei jälgita. Vali jälgitav mängija nimekirjast.');
    }
    log(`Stopped tracking ${player.gameName}#${player.tagLine}`);
    return player;
}

export async function createProGamers() {
    if (await hasPlayers()) {
        return;
    }
    const gameName = process.env.TRACKED_PLAYER || 'Skelegon';
    const tagLine = process.env.TRACKED_PLAYER_TAG || 'EUNE';
    const platformId = (process.env.TRACKED_PLAYER_REGION || 'EUN1').toUpperCase() as RiotPlatform;

    log(`Looking up initial tracked player: ${gameName}#${tagLine} (${platformId})`);

    try {
        const riotUser = await getRiotUserByRiotId(gameName, tagLine);
        if (!riotUser) {
            throw new Error(`Riot account not found: ${gameName}#${tagLine}`);
        }
        await createInitialTrackedPlayer({
            puuid: riotUser.puuid,
            gameName: riotUser.gameName,
            tagLine: riotUser.tagLine,
            platformId,
        });
    } catch (error) {
        log(error, LoggerType.ERROR);
    }
}
