import { expect } from 'chai';
import { db } from '../../../src/database/db';
import { LoanPayBack } from '../../../src/database/models/loan.model';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createLoan } from '../../../src/database/queries/loans.query';
import { loan } from '../../../src/services/discord/commands/loan/loan';
import {
    getTestBalanceTemplate,
    getTestInteraction,
    getTestUserTemplate,
    getUnresolvedTestLoanTemplate,
    TEST_DISCORD_USER,
} from '../../test-data';
import { sandbox, testDb } from '../init';
import { createUser } from '../../../src/database/queries/users.query';

describe('Discord command - /loan', () => {
    const { execute } = loan;
    it('Should create a balance if no balance is found.', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **100** muumimünti enda uuele kontole. GL!`,
            ephemeral: true,
        });
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
    });
    it('Should not give out a loan if the bankruptcy count is >= 5 or there is an unresolved loan', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await createUser(getTestUserTemplate());
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 100, bankruptcy: 5 }));
        await createLoan(getUnresolvedTestLoanTemplate());

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Suur Muum ei rahulda su laenusoovi ja soovitab majandusliku abi otsida mujalt`,
            components: [],
            ephemeral: true,
        });

        const balances = await testDb('balance');
        const loans = await testDb('loans').whereNot({ payback: LoanPayBack.UNRESOLVED });
        expect(loans.length).to.eq(0);
        expect(balances.length).to.eq(1);
        expect(balance.bankruptcy).to.greaterThanOrEqual(5);
    });
    it('Should not give out a loan if the requested amount is greater than set limit', async () => {
        const loanInput = 10000;
        const interaction = getTestInteraction({ options: { getInteger: () => loanInput } });
        const spy = sandbox.spy(interaction, 'reply');
        await createUser(getTestUserTemplate());
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 100 }));

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Suur Muum ei saa sinule nii suurt laenu pakkuda. Proovi laenata vähem kui **3000** muumimünti!`,
            components: [],
            ephemeral: true,
        });
        const loans = await db('loans');
        const balances = await db('balance');
        expect(loans.length).to.eq(0);
        expect(balances.length).to.eq(1);
        expect(balance.bankruptcy).to.lessThanOrEqual(0);
    });
    it('Should give out a loan if the bankruptcy count is less than 5, and the amount is below the limit', async () => {
        const loanInput = 1000;
        const interaction = getTestInteraction({ options: { getInteger: () => loanInput } });
        const spy = sandbox.spy(interaction, 'reply');
        await createUser(getTestUserTemplate());
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 1000, bankruptcy: 0 }));

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        const { deadline } = await testDb('loans').first();
        expect(spy.args[0][0]).to.deep.equal({
            content: `${TEST_DISCORD_USER.tag} sai **1000** laenu intressiga **8%**, tagasimakse aeg on **${deadline}**`,
            ephemeral: true,
        });

        const balances = await testDb('balance');
        const loans = await testDb('loans');

        expect(loans.length).to.eq(1);
        expect(balances.length).to.eq(1);
        expect(balance.bankruptcy).to.lessThanOrEqual(5);
    });
});
