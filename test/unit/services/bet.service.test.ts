import { DateTime } from 'luxon';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { getBetOdds, getUserProfit } from '../../../src/services/bet.service.ts';
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
        it('Should exclude refunded bets from profit regardless of their guess or odds', () => {
            const profit = getUserProfit([
                { guess: BetResult.WIN, result: BetResult.WIN, amount: 10, odds: 2 },
                { guess: BetResult.WIN, result: BetResult.VOID, amount: 50, odds: 2 },
                { guess: BetResult.LOSE, result: BetResult.VOID, amount: 100, odds: 1.4 },
            ]);
            expect(profit).to.eq(10);
        });
    });
    context('getBetOdds', () => {
        it('Odds should be 2, if the game length is less than 8 minutes', () => {
            const odds = getBetOdds(Number(DateTime.now()));
            expect(odds).to.eq(2);
        });
        it('Odds should be 1.6, if the game length is 8 minutes 1 seconds', () => {
            const odds = getBetOdds(Number(DateTime.now().minus({ minutes: 8, seconds: 1 })));
            expect(odds).to.eq(1.6);
        });
        it('Odds should be 1.4, if the game length is 12 minutes 1 seconds', () => {
            const odds = getBetOdds(Number(DateTime.now().minus({ minutes: 12, seconds: 1 })));
            expect(odds).to.eq(1.4);
        });
        it('Odds should be 1.1 if the game length is 20 minutes', () => {
            const odds = getBetOdds(Number(DateTime.now().minus({ minutes: 20 })));
            expect(odds).to.eq(1.1);
        });
    });
});
