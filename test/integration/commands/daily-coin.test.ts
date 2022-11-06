import { expect } from 'chai';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { dailyCoin } from '../../../src/services/discord/commands/daily-coin/daily-coin';
import { getTestBalanceTemplate, getTestInteraction } from '../../test-data';
import { sandbox, testDb } from '../init';

describe('Discord command - /daily-coin', async () => {
    const { execute } = dailyCoin;
    it.only('Should create new balance for user, if there is none', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const balances = await testDb('balance');

        expect(balances.length).to.eq(1);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: 100 muumimünti.`,
            ephemeral: true,
            components: [],
        });
    });
    it('Should update users balance if there is no previous record of using the command', async () => {
        const interaction = getTestInteraction();
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 100 }));

        await execute(interaction);

        const balances = await testDb('balance').whereNot({ amount: 100 });
        expect(balances.length).to.eq(1);
    });
});
