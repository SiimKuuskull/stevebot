import { getTestBalanceTemplate, getTestInteraction, getUnresolvedTestLoanTemplate } from '../../test-data';
import { sandbox, testDb } from '../init';
import { payback } from '../../../src/services/discord/commands/loan/payback';
import { expect } from 'chai';
import { LoanPayBack } from '../../../src/database/models/loan.model';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createLoan } from '../../../src/database/queries/loans.query';
import { createBettingAccount } from '../../../src/services/registration.service';

describe('Discord command - /payback', () => {
    const { execute } = payback;
    it('Should send a reply if there are no unresolved or any loans found', async () => {
        const { userId, userName } = getTestBalanceTemplate();
        const [balance] = await createBettingAccount(userId, userName);
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction, balance);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `${interaction.user.tag} ei ole ühtegi laenu võtnud või on laenud tagasi makstud.`,
            ephemeral: true,
            components: [],
        });

        const loans = await testDb('loans').where({ payback: LoanPayBack.UNRESOLVED });
        expect(loans.length).to.eq(0);
    });
    it(`Should pay back the loan if user's balance is greater or equal to the debt`, async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 2000 }));
        await createLoan(getUnresolvedTestLoanTemplate({ amount: 10 }));

        await execute(interaction, balance);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `${interaction.user.tag} laenu tagasimakse õnnestus. Kõik võlgnevused likvideeritud.`,
            ephemral: true,
            components: [],
        });
        await testDb('balance');
        const loans = await testDb('loans').where({ payback: LoanPayBack.RESOLVED });

        expect(loans.length).to.eq(1);
    });
    it(`Should send a reply if user's balance is not enough to pay back the loan`, async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 200 }));
        await createLoan(getUnresolvedTestLoanTemplate({ amount: 1000 }));

        await execute(interaction, balance);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Sul ei ole piisavalt muumimünte, et oma laenu tagasi maksta. Puudu on **880**`,
            ephemral: true,
            components: [],
        });
        await testDb('balance');
        const loans = await testDb('loans').where({ payback: LoanPayBack.UNRESOLVED });
        expect(loans.length).to.eq(1);
    });
});
