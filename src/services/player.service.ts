import { addPlayer } from '../database/queries/player.query';
import { log, LoggerType } from '../tools/logger';
import { getRiotUserBySummonerName } from './riot-games/requests';
import { map } from 'bluebird';
import { pick } from 'lodash';

export async function createProGamers() {
    const summonerNames = [
        'Akselgigant',
        'Freemandolin',
        'Loviatar',
        'Maidre',
        'Maisike',
        'Skelegon',
        'hents31',
        'Lé Chiffre',
        'Floopy1',
        'raspberryx1',
        'Joskris nr 1 fan',
    ];
    const trackedPlayer = 'Joskris nr 1 fan';
    log(`Adding pro gamers: ${summonerNames}`);
    await map(summonerNames, async (summonerName) => {
        try {
            const riotUser = await getRiotUserBySummonerName(summonerName);
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
