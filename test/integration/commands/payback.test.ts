import { sandbox, testDb } from '../init';
import { expect } from 'chai';
import { LoanPayBack } from '../../../src/database/models/loan.model';
import { TransactionType } from '../../../src/database/models/transactions.model';
import { createLoan } from '../../../src/database/queries/loans.query';
import { payback } from '../../../src/services/discord/commands/loan/payback';
import { useBettingAccount } from '../../../src/services/registration.service';
import { getTestInteraction, getUnresolvedTestLoanTemplate } from '../../test-data';

describe('Discord command - /payback', () => {
    const { execute } = payback;
    it('Should send a reply if there are no unresolved or any loans found', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `${interaction.user.tag} ei ole ühtegi laenu võtnud või on laenud tagasi makstud.`,
            ephemeral: true,
            components: [],
        });
    });
    it(`Should pay back the loan`, async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await useBettingAccount(interaction.user);
        await createLoan(getUnresolvedTestLoanTemplate({ amount: 50 }));

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `${interaction.user.tag} laenu tagasimakse õnnestus. Kõik võlgnevused likvideeritud.`,
            ephemral: true,
            components: [],
        });
        const [balance, loans, transactions] = await Promise.all([
            testDb('balance').first(),
            testDb('loans'),
            testDb('transactions').where({ type: TransactionType.LOAN_PAYBACK }),
        ]);
        expect(balance.amount).to.eq(46);
        expect(loans.length).to.eq(1);
        expect(loans[0].payback).to.eq(LoanPayBack.RESOLVED);
        expect(transactions.length).to.eq(1);
        expect(transactions[0].amount).to.eq(-54);
    });
    it(`Payback should not be allowed if user does not have enough coins`, async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        const { balance } = await useBettingAccount(interaction.user);
        await createLoan(getUnresolvedTestLoanTemplate({ amount: balance.amount }));

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Sul ei ole piisavalt muumimünte, et oma laenu tagasi maksta. Puudu on **8**`,
            ephemral: true,
            components: [],
        });
        const loans = await testDb('loans').where({ payback: LoanPayBack.UNRESOLVED });
        expect(loans.length).to.eq(1);
    });
});
