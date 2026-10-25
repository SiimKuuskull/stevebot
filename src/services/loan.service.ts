import lodash from 'lodash';
import { db } from '../database/db.ts';
import { type Loan, LoanPayBack } from '../database/models/loan.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { updateLateLoanBalance } from '../database/queries/balance.query.ts';
import { createLoan } from '../database/queries/loans.query.ts';
import { createTransaction } from '../database/queries/transactions.query.ts';
import { InteractionError } from '../tools/errors.ts';

export const MAX_LOAN_AMOUNT = 3000;

// All loan operations and bankruptcy lock balance before loans.
export async function issueLoan(userId: string, amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new InteractionError('Laenusumma peab olema positiivne täisarv.');
    }
    if (amount >= MAX_LOAN_AMOUNT) {
        throw new InteractionError(
            `Suur Muum ei saa sinule nii suurt laenu pakkuda. Proovi laenata vähem kui **${MAX_LOAN_AMOUNT}** muumimünti!`,
        );
    }
    return db.transaction(async (trx) => {
        const balance = await trx('balance').where({ userId }).first().forUpdate();
        const existing = await trx('loans').where({ userId, payback: LoanPayBack.UNRESOLVED }).first();
        if (!balance || balance.bankruptcy >= 5 || existing) {
            throw new InteractionError('Suur Muum ei rahulda su laenusoovi ja soovitab majandusliku abi otsida mujalt');
        }
        const loan = await createLoan({ userId, amount, interest: 0.08 }, trx);
        const [updated] = await trx('balance').where({ userId }).increment('amount', amount).returning('*');
        await createTransaction(
            {
                userId,
                amount,
                balance: updated.amount,
                externalTransactionId: loan.id,
                type: TransactionType.LOAN_RECEIVED,
            },
            trx,
        );
        return loan;
    });
}

export async function prepareLoanReminder(reference: Pick<Loan, 'id' | 'userId'>) {
    return db.transaction(async (trx) => {
        await trx('balance').where({ userId: reference.userId }).first().forUpdate();
        const loan = await trx('loans')
            .where({ id: reference.id, userId: reference.userId, payback: LoanPayBack.UNRESOLVED })
            .first()
            .forUpdate();
        if (!loan) {
            return;
        }
        const overdue = loan.deadline.getTime() <= Date.now();
        if (overdue) {
            await updateLateLoanBalance(loan.userId, trx);
        }
        return { loan, overdue };
    });
}

export async function repayLoan(userId: string) {
    return db.transaction(async (trx) => {
        const balance = await trx('balance').where({ userId }).first().forUpdate();
        const loan = await trx('loans')
            .where({ userId, payback: LoanPayBack.UNRESOLVED })
            .orderBy('id')
            .first()
            .forUpdate();
        if (!loan) {
            return;
        }
        if (!balance) {
            throw new InteractionError('Kontot ei leitud. Palun proovi hiljem uuesti.');
        }
        const amount = loan.amount + loan.amount * loan.interest;
        if (balance.amount < amount) {
            throw new InteractionError(
                `Sul ei ole piisavalt muumimünte, et oma laenu tagasi maksta. Puudu on **${lodash.round(amount - balance.amount, 2)}**`,
            );
        }
        const [updated] = await trx('balance').where({ userId }).decrement('amount', amount).returning('*');
        await trx('loans').where({ id: loan.id }).update({ payback: LoanPayBack.RESOLVED });
        await createTransaction(
            {
                userId,
                amount: -amount,
                balance: updated.amount,
                externalTransactionId: loan.id,
                type: TransactionType.LOAN_PAYBACK,
            },
            trx,
        );
        return loan;
    });
}
