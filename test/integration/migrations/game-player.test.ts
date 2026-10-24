import { expect } from 'chai';
import { testDb } from '../init.ts';
import { up, down } from '../../../src/database/migrations/20261024000000_game_player.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { getTestGameTemplate, getTestTrackedPlayerTemplate } from '../../test-data.ts';

describe('Game player migration', () => {
    it('Should preserve legacy games without assigning them to the current player', async () => {
        await down(testDb);
        await addPlayer(getTestTrackedPlayerTemplate());
        const [game] = await testDb('steve_games')
            .insert({ gameId: '3218543000', platformId: 'EUN1', gameStart: Date.now() })
            .returning('*');

        await up(testDb);

        expect(await testDb('steve_games').where({ id: game.id }).first()).to.include({
            gameId: game.gameId,
            platformId: 'EUN1',
            playerId: null,
        });
        await down(testDb);
        expect(await testDb.schema.hasColumn('steve_games', 'player_id')).to.eq(false);
        expect(await testDb('steve_games')).to.have.length(1);
        expect(await testDb('player')).to.have.length(1);
    });

    it('Should reject a game linked to a nonexistent player', async () => {
        let failure: unknown;
        try {
            await createSteveGame(getTestGameTemplate({ playerId: 999 }));
        } catch (error) {
            failure = error;
        }

        expect(failure).to.have.property('code', '23503');
        expect(await testDb('steve_games')).to.have.length(0);
    });

    it('Should prevent deleting a player referenced by a game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        await createSteveGame(getTestGameTemplate({ playerId: player.id }));

        let failure: unknown;
        try {
            await testDb('player').where({ id: player.id }).delete();
        } catch (error) {
            failure = error;
        }

        expect(failure).to.have.property('code', '23001');
        expect(await testDb('player')).to.have.length(1);
        expect(await testDb('steve_games')).to.have.length(1);
    });
});
