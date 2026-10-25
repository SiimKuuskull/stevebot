import { expect } from 'chai';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { LoanPayBack } from '../../../src/database/models/loan.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import { goBankrupt } from '../../../src/services/bankruptcy.service.ts';
import { confirmBet } from '../../../src/services/bet.service.ts';
import { issueLoan, prepareLoanReminder, repayLoan } from '../../../src/services/loan.service.ts';
import { getPastDeadlineTestLoanTemplate } from '../../test-data.ts';
import { bettingFixture } from '../betting-fixtures.ts';
import { testDb } from '../init.ts';

describe('Loans sharing a balance with multiple game bets', () => {
    it('Issues one loan and one credit when loan requests race', async () => {
        const fixture = await bettingFixture();
        const results = await Promise.allSettled([issueLoan(fixture.userId, 50), issueLoan(fixture.userId, 50)]);
        expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(150);
        expect(await testDb('loans')).to.have.length(1);
        expect(await testDb('transactions').where({ type: TransactionType.LOAN_RECEIVED })).to.have.length(1);
    });

    it('Rolls back loan creation and credit if the ledger cannot be written', async () => {
        const fixture = await bettingFixture();
        await testDb.raw("ALTER TABLE transactions ADD CONSTRAINT reject_loan CHECK (type <> 'LOAN_RECEIVED')");
        const [result] = await Promise.allSettled([issueLoan(fixture.userId, 50)]);
        expect(result.status).to.eq('rejected');
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('loans')).to.have.length(0);
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Cannot receive loan credit after the same debt was wiped by concurrent bankruptcy', async () => {
        const fixture = await bettingFixture();
        await Promise.all([issueLoan(fixture.userId, 50), goBankrupt(fixture.userId, 0)]);
        const loan = await testDb('loans').first();
        const balance = await testDb('balance').first();
        expect(balance?.bankruptcy).to.eq(1);
        expect(balance?.amount).to.eq(loan?.payback === LoanPayBack.WIPED ? 100 : 150);
        expect(await testDb('transactions')).to.have.length(2);
    });

    it('Rejects invalid loan amounts and rechecks the bankruptcy limit under the balance lock', async () => {
        const fixture = await bettingFixture();
        for (const amount of [0, -1, 1.5, NaN, Infinity, 3000]) {
            const [result] = await Promise.allSettled([issueLoan(fixture.userId, amount)]);
            expect(result.status).to.eq('rejected');
        }
        await testDb('balance').update({ bankruptcy: 5 });
        const [result] = await Promise.allSettled([issueLoan(fixture.userId, 50)]);
        expect(result.status).to.eq('rejected');
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('loans')).to.have.length(0);
    });

    it('Repays a loan once when repayment requests race', async () => {
        const fixture = await bettingFixture();
        await testDb('loans').insert(getPastDeadlineTestLoanTemplate({ amount: 50 }));
        const results = await Promise.all([repayLoan(fixture.userId), repayLoan(fixture.userId)]);
        expect(results.filter(Boolean)).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(46);
        expect((await testDb('loans').first())?.payback).to.eq(LoanPayBack.RESOLVED);
        expect(await testDb('transactions').where({ type: TransactionType.LOAN_PAYBACK })).to.have.length(1);
    });

    it('Keeps debt unresolved and the balance intact if repayment ledger insertion fails', async () => {
        const fixture = await bettingFixture();
        await testDb('loans').insert(getPastDeadlineTestLoanTemplate({ amount: 50 }));
        await testDb.raw("ALTER TABLE transactions ADD CONSTRAINT reject_payback CHECK (type <> 'LOAN_PAYBACK')");
        const [result] = await Promise.allSettled([repayLoan(fixture.userId)]);
        expect(result.status).to.eq('rejected');
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect((await testDb('loans').first())?.payback).to.eq(LoanPayBack.UNRESOLVED);
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Cannot spend the same coins on repayment and bets on different players', async () => {
        const first = await bettingFixture({ amount: 80 });
        const second = await bettingFixture({ suffix: 'second', amount: 80 });
        await testDb('balance').update({ amount: 150 });
        await testDb('loans').insert(getPastDeadlineTestLoanTemplate({ amount: 100 }));
        const results = await Promise.allSettled([
            repayLoan(first.userId),
            confirmBet(first.userId, first.reference, BetResult.WIN, 2, first.context),
            confirmBet(second.userId, second.reference, BetResult.LOSE, 2, second.context),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
        const transactions = await testDb('transactions');
        expect(transactions).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(150 + transactions[0].amount);
        expect((await testDb('loans').first())?.payback).to.eq(
            transactions[0].type === TransactionType.LOAN_PAYBACK ? LoanPayBack.RESOLVED : LoanPayBack.UNRESOLVED,
        );
    });

    for (const action of ['repayment', 'bankruptcy'] as const) {
        it(`Skips a stale Loan Shark candidate after ${action}`, async () => {
            const fixture = await bettingFixture();
            const [loan] = await testDb('loans')
                .insert(getPastDeadlineTestLoanTemplate({ amount: 50 }))
                .returning('*');
            if (action === 'repayment') {
                await repayLoan(fixture.userId);
            } else {
                await goBankrupt(fixture.userId, 0);
            }
            const before = await testDb('balance').first();
            expect(await prepareLoanReminder({ id: loan.id, userId: loan.userId })).to.eq(undefined);
            expect(await testDb('balance').first()).to.deep.eq(before);
        });
    }

    it('Does not apply an overdue penalty after a concurrent bankruptcy wipes the debt', async () => {
        const fixture = await bettingFixture();
        const [loan] = await testDb('loans').insert(getPastDeadlineTestLoanTemplate()).returning('*');
        await Promise.all([prepareLoanReminder({ id: loan.id, userId: loan.userId }), goBankrupt(fixture.userId, 0)]);
        expect(await testDb('balance').first()).to.include({ amount: 100, bankruptcy: 1, penalty: 0.2 });
        expect((await testDb('loans').first())?.payback).to.eq(LoanPayBack.WIPED);
    });
});
