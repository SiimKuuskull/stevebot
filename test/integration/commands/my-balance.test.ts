import { sandbox, testDb } from '../init';
import { myBalance } from '../../../src/services/discord/commands/my-balance/my-balance';
import { getTestBalanceTemplate, getTestInteraction } from '../../test-data';
import { expect } from 'chai';
import { createUserBalance } from '../../../src/database/queries/balance.query';

describe('Discord command - /my-balance', () => {
    const { execute } = myBalance;
    it('Should return existing balance', async () => {
        const existingBalance = await createUserBalance(getTestBalanceTemplate());
        await execute(getTestInteraction());
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
        expect(existingBalance).to.deep.equal(balances[0]);
    });
    it('Should create new balance for user', async () => {
        const interaction = sandbox.stub(getTestInteraction());
        await execute(interaction);
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
    });
});
