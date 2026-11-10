import { log } from '../../tools/logger.ts';
import { db } from '../db.ts';
import { type Loan, LoanPayBack } from '../models/loan.model.ts';

export async function createLoan(template: Partial<Loan>, knexTrx = db) {
    const payback = new Date(Date.now() + 604800000);
    const [loan] = await knexTrx('loans')
        .insert({ ...template, deadline: payback })
        .returning('*');
    log(`Created a new loan for ${loan.id} of ${loan.amount} credits with ${loan.interest * 100}% interest`);
    return loan;
}

export function findAllUnresolvedLoans() {
    return db('loans').where({ payback: LoanPayBack.UNRESOLVED });
}

export function findUserUnresolvedLoan(userId: string) {
    return db('loans').where({ payback: LoanPayBack.UNRESOLVED, userId }).first();
}
