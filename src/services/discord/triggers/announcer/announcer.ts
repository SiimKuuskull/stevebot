import { getActivegameBySummonerId } from '../../../../services/riot-games/requests';
import { botChannelId, client } from '../../client';

export const announcer = {
    interval: 60,
    execute: async () => {
        const activeGameId = await getActiveSteveGame();
        if (activeGameId) {
            const channel = client.channels.cache.get(botChannelId);
            (channel as any).send('Uus mäng hakkas');
        }
    },
};

async function getActiveSteveGame() {
    try {
        const game = await getActivegameBySummonerId('QdOpGBp4vSMBYbVgrW7gr3A4P2DBsAakR3qvwDgScDJCKxY');
        const isGameAnnounced = announcedGames.find((gameId) => gameId === game.gameId);
        if (!isGameAnnounced) {
            announcedGames.push(game.gameId);
            return game.gameId;
        }
    } catch (error) {
        if (error.statusCode === 404) {
            return;
        }
    }
}

// see peaks tegelt andmebaasis olema kuidagi
const announcedGames = [];
