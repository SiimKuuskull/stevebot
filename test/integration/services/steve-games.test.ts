import { expect } from 'chai';
import { testDb } from '../init.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';

describe('Game creation', () => {
    const invalidOwners = [
        { name: 'missing', fields: {} },
        { name: 'undefined', fields: { playerId: undefined } },
        { name: 'null', fields: { playerId: null } },
    ];

    for (const { name, fields } of invalidOwners) {
        it(`Should reject game creation when playerId is ${name}`, async () => {
            let failure: unknown;
            try {
                // @ts-expect-error Invalid callers must be rejected at runtime as well as by TypeScript.
                await createSteveGame({ gameId: '3218543000', platformId: 'EUN1', ...fields });
            } catch (error) {
                failure = error;
            }

            expect(failure).to.be.instanceOf(Error);
            expect(failure).to.have.property('message', 'A player ID is required to create a game');
            expect(await testDb('steve_games')).to.have.length(0);
        });
    }
});
