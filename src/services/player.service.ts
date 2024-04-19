import { addPlayer, unTrackAll } from '../database/queries/player.query';
import { log, LoggerType } from '../tools/logger';
import { getRiotUserByRiotId } from './riot-games/requests';
import { map } from 'bluebird';
import { pick } from 'lodash';

export async function createProGamers() {
    const trackedPlayerGameName = 'SunZun';
    const trackedPlayerTagLine = 'EUNE';
    const trackedPlayer = `${trackedPlayerGameName}` + '/' + `${trackedPlayerTagLine}`;
    const summonerNames = [trackedPlayer];
    log(`Adding pro gamers: ${summonerNames}`);
    await unTrackAll();
    await map(summonerNames, async (summonerName) => {
        try {
            const riotUser = await getRiotUserByRiotId(summonerNames);
            const template = {
                ...pick(riotUser, ['id', 'accountId', 'puuid', 'name']),
                isTracked: trackedPlayer === summonerName,
            };
            await addPlayer(template);
        } catch (error) {
            log(error, LoggerType.ERROR);
        }
    });
}
