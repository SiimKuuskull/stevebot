import { log } from '../../tools/logger';
import { db } from '../db';
import { Loan, LoanPayBack } from '../models/loan.model';

export async function createUserLoan(template: Partial<Loan>) {
    const payback = new Date(Date.now() + 604800000);
    log(payback);
    const [loan] = await db<Loan>('loans')
        .insert({ ...template, deadline: payback })
        .returning('*');
    log(`Created a new loan for ${loan.userName} of ${loan.amount} credits with ${loan.interest}% interest`);
    return loan;
}

export async function findUserLoan(userId: string) {
    const [loan] = await db<Loan>('loans').where('userId', userId);
    return loan;
}

export async function findUserActiveLoan(userId: string) {
    return await db<Loan>('loans').where({ userId: userId, payback: LoanPayBack.UNRESOLVED });
}

export async function resolveLoan(userId: string) {
    return await db<Loan>('loans')
        .where({ userId: userId, payback: LoanPayBack.UNRESOLVED })
        .update({ payback: LoanPayBack.RESOLVED });
}

export async function wipeUserLoans(userId: string) {
    return await db<Loan>('loans')
        .where({ userId: userId, payback: LoanPayBack.UNRESOLVED })
        .update({ payback: LoanPayBack.WIPED });
}
