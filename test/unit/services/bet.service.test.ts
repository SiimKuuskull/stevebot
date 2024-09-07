import { BetResult } from '../../../src/database/models/bet.model';
import { getUserProfit } from '../../../src/services/bet.service';
import { expect } from 'chai';

describe('Bet service', () => {
    context('getUserProfit', () => {
        it('Profit should be 0 if no bets', () => {
            const profit = getUserProfit([]);
            expect(profit).to.eq(0);
        });
        it('User should be in profit if they guessed correctly', () => {
            const profit = getUserProfit([{ guess: BetResult.WIN, result: BetResult.WIN, amount: 1, odds: 1.4 }]);
            expect(profit).to.eq(0.4);
        });
        it('User should not be in profit if they guessed wrong', () => {
            const profit = getUserProfit([{ guess: BetResult.WIN, result: BetResult.LOSE, amount: 1, odds: 1.4 }]);
            expect(profit).to.eq(-1);
        });
        it('Should not count in progress bet in profit calculation', () => {
            const profit = getUserProfit([
                { guess: BetResult.WIN, result: BetResult.WIN, amount: 1, odds: 1.4 },
                { guess: BetResult.WIN, result: BetResult.IN_PROGRESS, amount: 1, odds: 1.4 },
            ]);
            expect(profit).to.eq(0.4);
        });
        it('Should sum profit for multiple bets', () => {
            const profit = getUserProfit([
                { guess: BetResult.WIN, result: BetResult.WIN, amount: 1, odds: 1.4 },
                { guess: BetResult.WIN, result: BetResult.LOSE, amount: 1, odds: 1.4 },
                { guess: BetResult.WIN, result: BetResult.WIN, amount: 1, odds: 1.4 },
                { guess: BetResult.WIN, result: BetResult.WIN, amount: 1, odds: 1.4 },
                { guess: BetResult.WIN, result: BetResult.WIN, amount: 1, odds: 1.4 },
            ]);
            expect(profit).to.eq(0.6);
        });
    });
});
