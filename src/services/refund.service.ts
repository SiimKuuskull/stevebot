import { db } from '../database/db.ts';
import { type Bet } from '../database/models/bet.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { updateBalance } from '../database/queries/balance.query.ts';
import { voidInProgressBet } from '../database/queries/bets.query.ts';
import { lockInProgressGame } from '../database/queries/steveGames.query.ts';
import { createTransaction } from '../database/queries/transactions.query.ts';

export async function refundBet(bet: Bet) {
    return db.transaction(async (knexTrx) => {
        const game = await lockInProgressGame(bet.gameId, knexTrx);
        if (!game) {
            return;
        }
        const voidedBet = await voidInProgressBet(bet.id, knexTrx);
        if (!voidedBet) {
            return;
        }
        const balance = await updateBalance(voidedBet.userId, voidedBet.amount, false, knexTrx);
        return createTransaction(
            {
                amount: voidedBet.amount,
                balance: balance.amount,
                externalTransactionId: voidedBet.id,
                type: TransactionType.BET_REFUND,
                userId: voidedBet.userId,
            },
            knexTrx,
        );
    });
}
