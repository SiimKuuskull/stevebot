import { createLoan } from '../../../src/database/queries/loans.query';
import { testDb } from '../init';
import { expect } from 'chai';
import mocha from 'mocha';
import { loanShark } from '../../../src/services/discord/triggers/loan-shark/loan-shark';
import {
    getPastDeadlineTestLoanTemplate,
    getTestBalanceTemplate,
    getUnresolvedTestLoanTemplate,
    TEST_DISCORD_USER,
} from '../../test-data';
import { LoanPayBack } from '../../../src/database/models/loan.model';
import { createUserBalance, updateLateLoanBalance } from '../../../src/database/queries/balance.query';
import { enableLogs, log } from '../../../src/tools/logger';

describe('Triggers - loanShark', () => {
    const { execute } = loanShark;
    it.only('Should do nothing, if there are no unresolved loans', async () => {
        await execute();
        const loans = await testDb('loans');
        expect(loans.length).to.eq(0);
    });
    it.only('Should return an uresolved loan if there is one', async () => {
        const loan = await createLoan(getUnresolvedTestLoanTemplate());

        await execute();

        const loans = await testDb('loans');
        expect(loans.length).to.eq(1);
        expect(loan.payback).to.equal(LoanPayBack.UNRESOLVED);
    });
    it.only('Should penalise the user, if there is a past deadline unresolved loan', async () => {
        await createUserBalance(getTestBalanceTemplate({ userId: TEST_DISCORD_USER.id }));
        await createLoan(getPastDeadlineTestLoanTemplate());
        await updateLateLoanBalance(TEST_DISCORD_USER.id);

        await execute();

        const loans = await testDb('loans');
        const newBalance = await testDb('balance').first();
        expect(loans.length).to.eq(1);
        expect(newBalance.penalty).to.eq(0.3);
    });
    it('Should remind the user, if there is an unresolved loan', async () => {});
});
