import { getActivegameBySummonerId } from '../../../../services/riot-games/requests';
import { botChannelId, client } from '../../client';
import { db } from '../../../../database/db';

export const summonerId = 'NTOt3-RM93M20Vm25YMD0iUrayX-9GxlYBiqO3-vfCMJF8pZ1NViYcziQA';
export const summonerName = 'jyripro';

export const announcer = {
    interval: 10,
    execute: async () => {
        const activeGameId = (await getActiveSteveGame()).gameId;
        console.log(activeGameId);
        if (!activeGameId) {
            console.log('Ei ole mängu');
            const channel = client.channels.cache.get(botChannelId);
            (channel as any).send('Steve XP waste ');
            return;
        }
        const isGameAnnounced = await db('steve_games').select('game_status').first();
        if (!isGameAnnounced) {
            await db('steve_games')
                .insert({
                    gameid: activeGameId,
                    game_status: 'IN PROGRESS',
                })
                .then();
            const channel = client.channels.cache.get(botChannelId);
            (channel as any).send('Uus mäng hakkas gameid: ' + String(activeGameId));
            console.log('Mäng on andmebaasi lisatud!');
        }
    },
};

async function getActiveSteveGame() {
    try {
        const game = await getActivegameBySummonerId(summonerId);
        return game.gameId, game;
    } catch (error) {
        if (error.statusCode === 404) {
            return;
        }
    }
}

getActiveSteveGame();
