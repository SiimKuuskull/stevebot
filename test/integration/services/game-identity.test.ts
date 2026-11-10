import { rejects } from 'node:assert/strict';
import { expect } from 'chai';
import { testDb } from '../init.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import {
    createSteveGame,
    findSteveGameById,
    findSteveGameByMatch,
    updateSteveGame,
    voidGame,
} from '../../../src/database/queries/steveGames.query.ts';
import {
    createBet,
    deleteIncompleteBets,
    findActiveGameBets,
    findRefundableBets,
    findTopBet,
    resultBetsBySteveGameId,
} from '../../../src/database/queries/bets.query.ts';
import { createUserBalance, findUserBalance } from '../../../src/database/queries/balance.query.ts';
import {
    cancelBettingDraft,
    EXPIRED_BET_MESSAGE,
    loadBettingGame,
    startBettingDraft,
} from '../../../src/services/bet.service.ts';
import { makeTransaction } from '../../../src/services/transaction.service.ts';
import { refundBet } from '../../../src/services/refund.service.ts';
import { handler as getGameHistory } from '../../../src/endpoints/games/history.get.ts';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestTrackedPlayerTemplate,
} from '../../test-data.ts';

async function createSharedMatch(isTracked = false) {
    const first = await addPlayer(getTestTrackedPlayerTemplate({ isTracked }));
    const second = await addPlayer(getTestTrackedPlayerTemplate({ puuid: 'second', isTracked }));
    const a = await createSteveGame(
        getTestGameTemplate({ playerId: first.id, createdAt: new Date(Date.now() - 1000) }),
    );
    const b = await createSteveGame(getTestGameTemplate({ playerId: second.id }));
    return { a, b, first, second };
}

describe('Game and bet identity', () => {
    it('Should distinguish players and platforms while rejecting duplicate participation', async () => {
        const { a, b, first, second } = await createSharedMatch();
        const otherPlatform = await createSteveGame(getTestGameTemplate({ playerId: first.id, platformId: 'EUW1' }));

        expect((await findSteveGameById(a.id))?.playerId).to.eq(first.id);
        expect((await findSteveGameByMatch({ gameId: a.gameId, platformId: 'EUN1', playerId: second.id }))?.id).to.eq(
            b.id,
        );
        expect((await findSteveGameByMatch({ gameId: a.gameId, platformId: 'EUW1', playerId: first.id }))?.id).to.eq(
            otherPlatform.id,
        );
        await rejects(createSteveGame(getTestGameTemplate({ playerId: first.id })), { code: '23505' });
        expect(await testDb('steve_games')).to.have.length(3);
    });

    it('Should read only the selected participation for the same bettor', async () => {
        const { a, b } = await createSharedMatch();
        const betA = await createBet(getTestBetTemplate({ steveGameId: a.id }));
        const betB = await createBet(getTestBetTemplate({ steveGameId: b.id }));

        expect((await findActiveGameBets(a.id))?.map((bet) => bet.id)).to.deep.eq([betA.id]);
        expect((await findTopBet(a.id)).map((bet) => bet.id)).to.deep.eq([betA.id]);
        expect((await findTopBet(b.id)).map((bet) => bet.id)).to.deep.eq([betB.id]);
    });

    it('Should expose distinct game row IDs in history for a shared match', async () => {
        const { a, b } = await createSharedMatch();

        const history = await getGameHistory();

        expect(history).to.have.length(2);
        for (const game of [a, b]) {
            expect(history.find((entry) => entry.steveGameId === game.id)).to.include({
                id: game.gameId,
                playerId: game.playerId,
                platformId: game.platformId,
            });
        }
    });

    it('Should result one game and its bets independently of a shared match', async () => {
        const { a, b } = await createSharedMatch();
        const betA = await createBet(getTestBetTemplate({ steveGameId: a.id, guess: BetResult.WIN }));
        const betB = await createBet(getTestBetTemplate({ steveGameId: b.id, guess: BetResult.LOSE }));

        await updateSteveGame(
            a.id,
            { gameStatus: SteveGameStatus.COMPLETED, gameResult: true },
            SteveGameStatus.IN_PROGRESS,
        );
        await resultBetsBySteveGameId(a.id, { result: BetResult.WIN });

        expect((await findSteveGameById(a.id))?.gameResult).to.eq(true);
        expect((await findSteveGameById(b.id))?.gameStatus).to.eq(SteveGameStatus.IN_PROGRESS);
        expect((await testDb('bets').where({ id: betA.id }).first())?.result).to.eq(BetResult.WIN);
        expect(await testDb('bets').where({ id: betB.id }).first()).to.deep.eq(betB);
    });

    it('Should cancel and clean up drafts only for the selected game', async () => {
        const { a, b } = await createSharedMatch();
        const draftA = await createBet(getTestBetTemplate({ steveGameId: a.id }));
        const draftB = await createBet(getTestBetTemplate({ steveGameId: b.id }));
        const confirmed = await createBet(getTestBetTemplate({ steveGameId: a.id, guess: BetResult.WIN }));
        const refunded = await createBet(getTestBetTemplate({ steveGameId: a.id, result: BetResult.VOID }));

        await cancelBettingDraft(draftA.userId, { steveGameId: a.id, betId: draftA.id });
        expect(await testDb('bets').where({ id: draftA.id }).first()).to.eq(undefined);
        const otherDraft = await createBet(getTestBetTemplate({ steveGameId: a.id, userId: 'other' }));
        await deleteIncompleteBets(a.id);

        expect(await testDb('bets').where({ id: otherDraft.id }).first()).to.eq(undefined);
        expect(await testDb('bets').orderBy('id')).to.deep.eq([draftB, confirmed, refunded]);
    });

    it('Should refund one participation once while preserving the other stake', async () => {
        const { a, b } = await createSharedMatch();
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const betA = await createBet(getTestBetTemplate({ steveGameId: a.id, amount: 10, guess: BetResult.WIN }));
        const betB = await createBet(getTestBetTemplate({ steveGameId: b.id, amount: 20, guess: BetResult.LOSE }));
        for (const bet of [betA, betB]) {
            await makeTransaction({
                userId: bet.userId,
                amount: -bet.amount,
                externalTransactionId: bet.id,
                type: TransactionType.BET_PLACED,
            });
        }

        expect((await findRefundableBets(a.id)).map((bet) => bet.id)).to.deep.eq([betA.id]);
        await Promise.all([refundBet(betA), refundBet(betA)]);
        await voidGame(a.id);

        expect((await findUserBalance(balance.userId))?.amount).to.eq(80);
        expect(await testDb('bets').where({ id: betB.id }).first()).to.deep.eq(betB);
        expect((await findSteveGameById(a.id))?.gameStatus).to.eq(SteveGameStatus.VOID);
        expect((await findSteveGameById(b.id))?.gameStatus).to.eq(SteveGameStatus.IN_PROGRESS);
        const refunds = await testDb('transactions').where({ type: TransactionType.BET_REFUND });
        expect(refunds).to.have.length(1);
        expect(refunds[0].externalTransactionId).to.eq(betA.id);
    });

    it('Should lock the referenced game even when another participation is completed', async () => {
        const { a, b } = await createSharedMatch();
        await updateSteveGame(a.id, { gameStatus: SteveGameStatus.COMPLETED });
        await createUserBalance(getTestBalanceTemplate({ amount: 90 }));
        const bet = await createBet(getTestBetTemplate({ steveGameId: b.id, guess: BetResult.WIN }));

        expect(await refundBet(bet)).to.include({ externalTransactionId: bet.id, amount: 10 });
        expect((await findSteveGameById(a.id))?.gameStatus).to.eq(SteveGameStatus.COMPLETED);
    });

    it('Should attach a draft to the supplied game even when a newer game exists', async () => {
        const { a, b, first } = await createSharedMatch(true);
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 100 }));

        const bet = await startBettingDraft(balance.userId, { game: a, player: first, startTime: Date.now() });

        expect(bet).to.include({ steveGameId: a.id, amount: 0, guess: BetResult.IN_PROGRESS });
        expect(await testDb('bets').where({ steveGameId: b.id })).to.have.length(0);
        expect((await findUserBalance(balance.userId))?.amount).to.eq(100);
    });

    it('Should reject an unknown game ID even when active games exist', async () => {
        const { a, b } = await createSharedMatch(true);

        await rejects(loadBettingGame(Math.max(a.id, b.id) + 1), { message: EXPIRED_BET_MESSAGE });

        expect(await testDb('bets')).to.have.length(0);
    });

    it('Should reject a finished supplied game instead of switching to an active game', async () => {
        const { a, first } = await createSharedMatch(true);
        await updateSteveGame(a.id, { gameStatus: SteveGameStatus.COMPLETED });
        const balance = await createUserBalance(getTestBalanceTemplate({ amount: 100 }));

        await rejects(startBettingDraft(balance.userId, { game: a, player: first, startTime: Date.now() }), {
            message: EXPIRED_BET_MESSAGE,
        });

        expect(await testDb('bets')).to.have.length(0);
    });
});
