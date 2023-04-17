import { createLoan } from '../../../src/database/queries/loans.query';
import { sandbox, testDb } from '../init';
import { expect } from 'chai';
import { loanShark } from '../../../src/services/discord/triggers/loan-shark/loan-shark';
import {
    getPastDeadlineTestLoanTemplate,
    getTestBalanceTemplate,
    getUnresolvedTestLoanTemplate,
    TEST_DISCORD_USER,
} from '../../test-data';
import { LoanPayBack } from '../../../src/database/models/loan.model';
import { createUserBalance, updateLateLoanBalance } from '../../../src/database/queries/balance.query';
import * as Utils from '../../../src/services/discord/utils';

describe('Triggers - loanShark', () => {
    const { execute } = loanShark;
    it('Should do nothing, if there are no unresolved loans', async () => {
        await execute();
        const loans = await testDb('loans');
        expect(loans.length).to.eq(0);
    });
    it('Should return an uresolved loan if there is one', async () => {
        const loan = await createLoan(getUnresolvedTestLoanTemplate());

        await execute();

        const loans = await testDb('loans');
        expect(loans.length).to.eq(1);
        expect(loan.payback).to.equal(LoanPayBack.UNRESOLVED);
    });
    it('Should penalise the user, if there is a past deadline unresolved loan', async () => {
        await createUserBalance(getTestBalanceTemplate({ userId: TEST_DISCORD_USER.id }));
        await createLoan(getPastDeadlineTestLoanTemplate());
        await updateLateLoanBalance(TEST_DISCORD_USER.id);

        await execute();

        const loans = await testDb('loans');
        const newBalance = await testDb('balance').first();
        expect(loans.length).to.eq(1);
        expect(newBalance.penalty).to.eq(0.3);
    });
    it('Should remind the user, if there is an unresolved loan', async () => {
        const loan = await createLoan(getUnresolvedTestLoanTemplate());
        const message = `Meeldetuletus: võlgned Suurele Muumile ${
            loan.amount + loan.amount * loan.interest
        }, tagasimakse tähtaeg on: ${loan.deadline} `;
        const fakeMessage = sandbox.stub(Utils, 'sendPrivateMessageToGambler');

        await execute();

        expect(fakeMessage.called).to.eq(true);
        expect(fakeMessage.calledWith(message));
    });
    it('Should remind the user, if there is a past deadline loan', async () => {
        const loan = await createLoan(getPastDeadlineTestLoanTemplate());
        const message = `Meeldetuletus: võlgned Suurele Muumile ${
            loan.amount + loan.amount * loan.interest
        }, tagasimakse tähtaeg oli: ${loan.deadline}. Teie järgmisel neljal võidul on väiksem kasum.`;
        const fakeMessage = sandbox.stub(Utils, 'sendPrivateMessageToGambler');

        await execute();

        expect(fakeMessage.called).to.eq(true);
        expect(fakeMessage.calledWith(message));
    });
});
