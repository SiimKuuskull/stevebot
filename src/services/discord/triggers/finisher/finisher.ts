import { db } from '../../../../database/db';
import { getActivegameBySummonerId } from '../../../riot-games/requests';
import { botChannelId, client } from '../../client';
import { summonerId } from '../announcer/announcer';

export const finisher = {
    interval: 5,
    execute: async () => {
        const gameProgress = await db('steve_games').where({ game_status: 'IN PROGRESS' }).first();
        if (!gameProgress) {
            console.log('Steve XP waste');
            return;
        }
        const activeGameId = (await getActivegameBySummonerId(summonerId)).gameId;
        if (!activeGameId) {
            await db('steve_games').where({ id: gameProgress.id }).update({ game_status: 'COMPLETED' });
            console.log('Steve mäng sai läbi! Andmebaas uuendatud!');
            const channel = client.channels.cache.get(botChannelId);
            (channel as any).send('Steve mäng lõppes!');
        }
    },
};
