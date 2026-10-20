import { db } from '../database/db.ts';
import { Bet, BetResult } from '../database/models/bet.model.ts';
import { SteveGameStatus } from '../database/models/steveGame.model.ts';
import { TransactionType } from '../database/models/transactions.model.ts';
import { updateBalance } from '../database/queries/balance.query.ts';
import { createTransaction } from '../database/queries/transactions.query.ts';

export async function refundBet(bet: Bet) {
    return db.transaction(async (knexTrx) => {
        const game = await knexTrx('steve_games')
            .where({ gameId: bet.gameId, gameStatus: SteveGameStatus.IN_PROGRESS })
            .first()
            .forShare();
        if (!game) {
            return;
        }
        const [voidedBet] = await knexTrx('bets')
            .where({ id: bet.id, result: BetResult.IN_PROGRESS })
            .update({ result: BetResult.VOID })
            .returning('*');
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
