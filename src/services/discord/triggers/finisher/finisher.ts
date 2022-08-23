import { SteveGameStatus } from '../../../../database/models/steveGame.model';
import { findInprogressGame, updateSteveGame } from '../../../../database/queries/steveGames.query';
import { log } from '../../../../tools/logger';
import { getActivegameBySummonerId } from '../../../riot-games/requests';
import { sendChannelMessage } from '../../utils';
import { summonerId } from '../announcer/announcer';

export const finisher = {
    interval: 5,
    execute: async () => {
        const game = await findInprogressGame();
        if (!game) {
            log('Steve XP waste');
            return;
        }
        const activeGameId = (await getActivegameBySummonerId(summonerId)).gameId;
        if (!activeGameId) {
            await updateSteveGame(game.id, { gameStatus: SteveGameStatus.COMPLETED });
            log('Steve mäng sai läbi! Andmebaas uuendatud!');
            sendChannelMessage('Steve mäng lõppes');
        }
    },
};
