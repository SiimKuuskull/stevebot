import { sandbox, testDb } from '../init';
import { myBalance } from '../../../src/services/discord/commands/my-balance/my-balance';
import { getTestBalanceTemplate, getTestInteraction, getTestUserTemplate } from '../../test-data';
import { expect } from 'chai';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createUser } from '../../../src/database/queries/users.query';

describe('Discord command - /my-balance', () => {
    const { execute } = myBalance;
    it('Should return existing balance', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        const existingBalance = await createUserBalance(getTestBalanceTemplate());
        await createUser(getTestUserTemplate());

        await execute(interaction);

        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
        expect(existingBalance).to.deep.equal(balances[0]);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Sul on **100** muumimünti`,
            ephemeral: true,
        });
    });
    it('Should create new balance for user if there is no existing balance', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);
        const [balances, users] = await Promise.all([testDb('balance'), testDb('users')]);
        expect(balances.length).to.eq(1);
        expect(users.length).to.eq(1);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: **100** muumimünti. :wink:`,
            ephemeral: true,
        });
    });
});
