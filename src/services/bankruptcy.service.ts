import { db } from '../database/db.ts';
import { LoanPayBack } from '../database/models/loan.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { findUserConfirmedInProgressBet } from '../database/queries/bets.query.ts';
import { createTransaction } from '../database/queries/transactions.query.ts';
import { InteractionError } from '../tools/errors.ts';

export const BANKRUPTCY_LIMIT_MESSAGE =
    'Suur Muum ei rahulda su pankrotiavaldust ja soovitab majandusliku abi otsida mujalt';
export const BANKRUPTCY_ACTIVE_BETS_MESSAGE =
    'Sul on hetkel veel aktiivseid panuseid. Oota mängu lõppu ja proovi uuesti!';
export const BANKRUPTCY_EXPIRED_MESSAGE = 'See pankrotiavaldus on aegunud. Alusta uuesti käsuga /bankruptcy.';

export async function goBankrupt(userId: string, expectedCount: number) {
    return db.transaction(async (trx) => {
        // Bet confirmation also holds this balance while saving the decision and debit.
        // Read bets without locking them: confirmation takes its bet lock before the balance lock.
        const balance = await trx('balance').where({ userId }).first().forUpdate();
        if (!balance || balance.bankruptcy !== expectedCount) {
            throw new InteractionError(BANKRUPTCY_EXPIRED_MESSAGE);
        }
        if (balance.bankruptcy >= 9) {
            throw new InteractionError(BANKRUPTCY_LIMIT_MESSAGE);
        }
        if (await findUserConfirmedInProgressBet(userId, trx)) {
            throw new InteractionError(BANKRUPTCY_ACTIVE_BETS_MESSAGE);
        }
        const count = balance.bankruptcy + 1;
        const [updated] = await trx('balance')
            .where({ userId })
            .update({ amount: 100, bankruptcy: count, penalty: (count + 1) / 10 })
            .returning('*');
        await trx('loans').where({ userId, payback: LoanPayBack.UNRESOLVED }).update({ payback: LoanPayBack.WIPED });
        await createTransaction(
            {
                userId,
                amount: 100 - balance.amount,
                balance: updated.amount,
                externalTransactionId: balance.id,
                type: TransactionType.BANKRUPTCY,
            },
            trx,
        );
        return updated;
    });
}
