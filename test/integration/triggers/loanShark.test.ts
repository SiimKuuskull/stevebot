import { expect } from 'chai';
import { LoanPayBack } from '../../../src/database/models/loan.model.ts';
import {
    createUserBalance,
    updateBalancePenalty,
    updateLateLoanBalance,
} from '../../../src/database/queries/balance.query.ts';
import { loanShark } from '../../../src/services/discord/triggers/loan-shark/loan-shark.ts';
import { discordMessages } from '../../../src/services/discord/utils.ts';
import {
    getPastDeadlineTestLoanTemplate,
    getTestBalanceTemplate,
    getUnresolvedTestLoanTemplate,
    TEST_DISCORD_USER,
} from '../../test-data.ts';
import { bettingFixture } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

describe('Triggers - loanShark', () => {
    it('Does nothing when there are no unresolved loans', async () => {
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        await loanShark.execute();
        expect(notify.called).to.eq(false);
    });

    it('Reminds about a future loan without adding a penalty', async () => {
        await createUserBalance(getTestBalanceTemplate());
        const [loan] = await testDb('loans')
            .insert(getUnresolvedTestLoanTemplate({ deadline: new Date(Date.now() + 86400000) }))
            .returning('*');
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        await loanShark.execute();
        expect((await testDb('balance').first())?.penalty).to.eq(0);
        expect((await testDb('loans').first())?.payback).to.eq(LoanPayBack.UNRESOLVED);
        expect(
            notify.calledOnceWithExactly(
                `Meeldetuletus: võlgned Suurele Muumile ${loan.amount + loan.amount * loan.interest}, tagasimakse tähtaeg on: ${loan.deadline} `,
                loan.userId,
            ),
        ).to.eq(true);
    });

    it('Penalises an overdue loan once per run even with bets on three tracked players', async () => {
        await bettingFixture();
        await bettingFixture({ suffix: 'second' });
        await bettingFixture({ suffix: 'third' });
        const [loan] = await testDb('loans').insert(getPastDeadlineTestLoanTemplate()).returning('*');
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        await loanShark.execute();
        expect((await testDb('balance').first())?.penalty).to.eq(0.3);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('bets')).to.have.length(3);
        expect(
            notify.calledOnceWithExactly(
                `Meeldetuletus: võlgned Suurele Muumile ${loan.amount + loan.amount * loan.interest}, tagasimakse tähtaeg oli: ${loan.deadline}. Teie tulevaste panuste väljamaksetele rakendub lisalõiv.`,
                loan.userId,
            ),
        ).to.eq(true);
    });

    it('Treats the exact deadline as overdue', async () => {
        const now = Date.now();
        sandbox.useFakeTimers({ now, toFake: ['Date'] });
        await createUserBalance(getTestBalanceTemplate());
        await testDb('loans').insert(getUnresolvedTestLoanTemplate({ deadline: new Date(now) }));
        sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        await loanShark.execute();
        expect((await testDb('balance').first())?.penalty).to.eq(0.3);
    });

    it('Skips repaid and wiped loans', async () => {
        await createUserBalance(getTestBalanceTemplate());
        await testDb('loans').insert([
            getPastDeadlineTestLoanTemplate({ payback: LoanPayBack.RESOLVED }),
            getPastDeadlineTestLoanTemplate({ payback: LoanPayBack.WIPED }),
        ]);
        const notify = sandbox.stub(discordMessages, 'sendPrivateMessageToGambler').resolves();
        await loanShark.execute();
        expect((await testDb('balance').first())?.penalty).to.eq(0);
        expect(notify.called).to.eq(false);
    });

    it('Preserves simultaneous penalty additions and a settlement penalty reduction', async () => {
        await createUserBalance(getTestBalanceTemplate({ penalty: 0.5 }));
        await Promise.all([
            updateLateLoanBalance(TEST_DISCORD_USER.id),
            updateLateLoanBalance(TEST_DISCORD_USER.id),
            updateBalancePenalty(TEST_DISCORD_USER.id),
        ]);
        expect((await testDb('balance').first())?.penalty).to.be.closeTo(1, 0.000001);
    });

    it('Continues processing other loans when an account or Discord notification fails', async () => {
        await testDb('loans').insert(getPastDeadlineTestLoanTemplate({ userId: 'missing-account' }));
        for (const userId of ['first', 'second']) {
            await createUserBalance(getTestBalanceTemplate({ userId }));
            await testDb('loans').insert(getPastDeadlineTestLoanTemplate({ userId }));
        }
        const notify = sandbox
            .stub(discordMessages, 'sendPrivateMessageToGambler')
            .callsFake((_message, userId) =>
                userId === 'first' ? Promise.reject(new Error('Discord unavailable')) : Promise.resolve(),
            );
        await loanShark.execute();
        expect(notify.callCount).to.eq(2);
        for (const balance of await testDb('balance')) {
            expect(balance.penalty).to.eq(0.3);
        }
    });
});
