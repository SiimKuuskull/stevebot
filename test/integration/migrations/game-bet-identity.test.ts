import { rejects } from 'node:assert/strict';
import { expect } from 'chai';
import { testDb } from '../init.ts';
import { up, down } from '../../../src/database/migrations/20261025000000_game_bet_identity.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { createBet } from '../../../src/database/queries/bets.query.ts';
import { getTestBetTemplate, getTestGameTemplate, getTestTrackedPlayerTemplate } from '../../test-data.ts';

describe('Game bet identity migration', () => {
    it('Should backfill bets including unknown owners and restore their original IDs on rollback', async () => {
        await testDb.transaction(down);
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        await testDb('steve_games').insert([
            { id: 41, gameId: '111', platformId: 'EUN1', playerId: null },
            { id: 42, gameId: '222', platformId: 'EUW1', playerId: player.id },
        ]);
        await testDb.raw(`
            INSERT INTO bets (id, user_id, game_id, amount, odds, guess, result)
            VALUES (51, 'first', 111, 25, 2, 'WIN', 'WIN'),
                   (52, 'second', 222, 10, 1.6, 'LOSE', 'IN PROGRESS'),
                   (53, 'third', 111, 50, 2, 'WIN', 'VOID')
        `);
        const fields = ['id', 'userId', 'amount', 'odds', 'guess', 'result', 'createdAt', 'updatedAt'];
        const before = await testDb('bets').select(fields).orderBy('id');

        await testDb.transaction(up);

        expect(await testDb('bets').select(fields).orderBy('id')).to.deep.eq(before);
        expect((await testDb('bets').orderBy('id')).map((bet) => bet.steveGameId)).to.deep.eq([41, 42, 41]);
        expect((await testDb('steve_games').where({ id: 41 }).first())?.playerId).to.eq(null);
        expect(await testDb.schema.hasColumn('bets', 'game_id')).to.eq(false);

        await testDb.transaction(down);

        const restored = await testDb.raw('SELECT game_id AS original FROM bets ORDER BY id');
        expect(restored.rows.map((row: { original: string }) => row.original)).to.deep.eq(['111', '222', '111']);
        expect(await testDb('bets').select(fields).orderBy('id')).to.deep.eq(before);
        expect(await testDb.schema.hasColumn('bets', 'steve_game_id')).to.eq(false);
    });

    it('Should roll back the whole migration and report orphaned bet IDs', async () => {
        await testDb.transaction(down);
        await testDb('steve_games').insert({ gameId: '111', platformId: 'EUN1' });
        await testDb.raw("INSERT INTO bets (id, user_id, game_id) VALUES (61, 'known', 111), (62, 'orphan', 999)");

        await rejects(testDb.transaction(up), /Cannot migrate bets without matching games.*62/);

        expect(await testDb.schema.hasColumn('bets', 'steve_game_id')).to.eq(false);
        expect(await testDb.schema.hasColumn('bets', 'game_id')).to.eq(true);
        expect(await testDb('bets')).to.have.length(2);
        await rejects(
            async () => {
                await testDb('steve_games').insert({ gameId: '111', platformId: 'EUW1' });
            },
            { code: '23505' },
        );
    });

    it('Should refuse destructive rollback when Riot IDs are shared across game rows', async () => {
        const first = await addPlayer(getTestTrackedPlayerTemplate());
        const second = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'second', isTracked: false }));
        const game = await createSteveGame(getTestGameTemplate({ playerId: first.id }));
        await createSteveGame(getTestGameTemplate({ playerId: second.id }));
        const bet = await createBet(getTestBetTemplate({ steveGameId: game.id }));

        await rejects(testDb.transaction(down), /multiple games share a Riot game ID/);

        expect(await testDb.schema.hasColumn('bets', 'game_id')).to.eq(false);
        expect(await testDb('steve_games')).to.have.length(2);
        expect(await testDb('bets')).to.deep.eq([bet]);
    });

    it('Should enforce required game references and preserve games with betting history', async () => {
        await rejects(
            async () => {
                await testDb('bets').insert({ userId: 'missing' });
            },
            { code: '23502' },
        );
        await rejects(
            async () => {
                await createBet({ userId: 'invalid', steveGameId: 999 });
            },
            { code: '23503' },
        );
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ playerId: player.id }));
        const bet = await createBet(getTestBetTemplate({ steveGameId: game.id }));

        await rejects(
            async () => {
                await testDb('steve_games').where({ id: game.id }).del();
            },
            { code: '23001' },
        );

        expect(await testDb('bets')).to.deep.eq([bet]);
        expect(await testDb('steve_games')).to.have.length(1);
    });
});
