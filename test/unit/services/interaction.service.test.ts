import { expect } from 'chai';
import {
    bettingCustomId,
    Interaction,
    parseBettingCustomId,
    parseDatabaseId,
} from '../../../src/services/interaction.service.ts';

describe('Betting interaction identifiers', () => {
    it('Rejects legacy, partial, ambiguous, oversized and malformed IDs', () => {
        for (const value of [
            undefined,
            '',
            'BET_WIN',
            'BET_WIN:1:2',
            'BET_WIN:1:2:NaN',
            'BET_WIN:1:2:3',
            'BET_WIN:1:2:2:extra',
            'BET_WIN:0:2:2',
            'BET_WIN:-1:2:2',
            'BET_WIN:01:2:2',
            'BET_WIN:1:2147483648:2',
            'BET_WIN:1:2.5:2',
            'BET_WIN:1e2:2:2',
            'AMOUNT_SELECTED:1:2:',
            'AMOUNT_SELECTED:1:2:2',
            '__proto__:1:2',
            'GAME_SELECTED:1:2',
        ]) {
            expect(parseBettingCustomId(value), String(value)).to.eq(undefined);
        }
    });

    it('Carries game, draft and displayed odds within the Discord custom ID limit', () => {
        const reference = { steveGameId: 2147483647, betId: 2147483647 };
        for (const action of [Interaction.BET_WIN, Interaction.BET_LOSE] as const) {
            for (const odds of [2, 1.6, 1.4, 1.1]) {
                const id = bettingCustomId(action, reference, odds);
                expect(id.length).to.be.lessThan(101);
                expect(parseBettingCustomId(id)).to.deep.eq({ ...reference, action, odds });
            }
        }
    });

    it('Accepts bound amount, modal and cancel actions without an odds quote', () => {
        const reference = { steveGameId: 12, betId: 34 };
        for (const action of [
            Interaction.AMOUNT_SELECTED,
            Interaction.AMOUNT_SELECTED_CUSTOM,
            Interaction.BET_CANCEL,
        ] as const) {
            expect(parseBettingCustomId(bettingCustomId(action, reference))).to.deep.eq({
                ...reference,
                action,
                odds: undefined,
            });
        }
    });

    it('Rejects invalid game selector values rather than coercing them to IDs', () => {
        for (const value of [null, 1, '-1', '0', '1.1', '1e2', ' 1', '01', '2147483648', '9007199254740993']) {
            expect(parseDatabaseId(value)).to.eq(undefined);
        }
        expect(parseDatabaseId('1')).to.eq(1);
    });
});
