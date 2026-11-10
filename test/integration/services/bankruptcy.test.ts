import { expect } from 'chai';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { LoanPayBack } from '../../../src/database/models/loan.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import {
    BANKRUPTCY_ACTIVE_BETS_MESSAGE,
    BANKRUPTCY_EXPIRED_MESSAGE,
    BANKRUPTCY_LIMIT_MESSAGE,
    goBankrupt,
} from '../../../src/services/bankruptcy.service.ts';
import { confirmBet } from '../../../src/services/bet.service.ts';
import { bankruptcy } from '../../../src/services/discord/commands/bankruptcy/bankruptcy.ts';
import { bankruptcyDeclared } from '../../../src/services/discord/interactions/loans/bankruptcyDeclared.ts';
import { interaction as interactionEvent } from '../../../src/services/discord/events/interaction/interaction.ts';
import { getPastDeadlineTestLoanTemplate, getTestInteraction } from '../../test-data.ts';
import { bettingFixture } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

describe('Bankruptcy with multiple tracked games', () => {
    it('Allows bankruptcy with only unconfirmed drafts across multiple games', async () => {
        const first = await bettingFixture();
        const second = await bettingFixture({ suffix: 'second', amount: 20 });
        await testDb('balance').update({ amount: 0 });
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'reply');
        await bankruptcy.execute(interaction);
        expect(reply.firstCall.args[0].content).to.include('Oled välja kuulutanud pankroti');
        expect(await testDb('balance').first()).to.include({ amount: 100, bankruptcy: 1 });
        expect((await testDb('bets').orderBy('id')).map((bet) => bet.id)).to.deep.eq([first.bet.id, second.bet.id]);
        expect(await testDb('transactions').where({ type: TransactionType.BET_PLACED })).to.have.length(0);
    });

    it('Blocks bankruptcy for a confirmed bet on another player even after tracking stops', async () => {
        await bettingFixture();
        const second = await bettingFixture({ suffix: 'second', amount: 20 });
        await testDb('bets').where({ id: second.bet.id }).update({ guess: BetResult.LOSE });
        await testDb('player').where({ id: second.player.id }).update({ isTracked: false });
        const interaction = getTestInteraction();
        const reply = sandbox.spy(interaction, 'reply');
        await bankruptcy.execute(interaction);
        expect(reply.firstCall.args[0].content).to.eq(BANKRUPTCY_ACTIVE_BETS_MESSAGE);
        expect((await testDb('balance').first())?.bankruptcy).to.eq(0);
    });

    it('Rechecks all games when an old bankruptcy button is clicked after placing a bet', async () => {
        await bettingFixture();
        const second = await bettingFixture({ suffix: 'second', amount: 20 });
        const command = getTestInteraction();
        const menu = sandbox.spy(command, 'reply');
        await bankruptcy.execute(command);
        const customId = menu.firstCall.args[0].components[0].toJSON().components[0].custom_id;
        await confirmBet(second.userId, second.reference, BetResult.WIN, 2, second.context);
        const click = getTestInteraction({ customId, isCommand: () => false, channel: { name: 'test' } });
        const reply = sandbox.spy(click, 'editReply');
        await interactionEvent.execute(click, {});
        expect(reply.firstCall.args[0].content).to.eq(BANKRUPTCY_ACTIVE_BETS_MESSAGE);
        expect(await testDb('balance').first()).to.include({ amount: 80, bankruptcy: 0 });
        expect(await testDb('transactions').where({ type: TransactionType.BANKRUPTCY })).to.have.length(0);
    });

    it('Permits bankruptcy after bets are refunded or settled and ignores other users bets', async () => {
        const first = await bettingFixture({ amount: 20 });
        const second = await bettingFixture({ suffix: 'second', amount: 20 });
        await testDb('bets').where({ id: first.bet.id }).update({ guess: BetResult.WIN, result: BetResult.VOID });
        await testDb('bets').where({ id: second.bet.id }).update({ guess: BetResult.LOSE, result: BetResult.WIN });
        await testDb('bets').insert({
            userId: 'someone-else',
            steveGameId: first.game.id,
            guess: BetResult.WIN,
            result: BetResult.IN_PROGRESS,
            amount: 50,
        });
        expect((await goBankrupt(first.userId, 0)).bankruptcy).to.eq(1);
        expect(await testDb('bets')).to.have.length(3);
    });

    it('Applies a bankruptcy confirmation once when two clicks race', async () => {
        const fixture = await bettingFixture();
        await testDb('balance').update({ amount: 20 });
        const results = await Promise.allSettled([goBankrupt(fixture.userId, 0), goBankrupt(fixture.userId, 0)]);
        expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
        expect(await testDb('balance').first()).to.include({ amount: 100, bankruptcy: 1, penalty: 0.2 });
        const transactions = await testDb('transactions').where({ type: TransactionType.BANKRUPTCY });
        expect(transactions).to.have.length(1);
        expect(transactions[0]).to.include({ amount: 80, balance: 100 });
    });

    it('Rejects legacy, malformed, repeated and over-limit bankruptcy confirmations', async () => {
        const fixture = await bettingFixture();
        for (const customId of [
            'BANKRUPTCY_DECLARED',
            'BANKRUPTCY_DECLARED:-1',
            'BANKRUPTCY_DECLARED:0:extra',
            'BANKRUPTCY_DECLARED:1',
        ]) {
            const click = getTestInteraction({ customId });
            const reply = sandbox.spy(click, 'editReply');
            await bankruptcyDeclared(click);
            expect(reply.firstCall.args[0].content).to.eq(BANKRUPTCY_EXPIRED_MESSAGE);
        }
        await testDb('balance').update({ bankruptcy: 9 });
        const [result] = await Promise.allSettled([goBankrupt(fixture.userId, 9)]);
        expect(result.status).to.eq('rejected');
        if (result.status === 'rejected') {
            expect(result.reason.message).to.eq(BANKRUPTCY_LIMIT_MESSAGE);
        }
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Rolls back the balance, count, penalty and loan wipe if bankruptcy ledger insertion fails', async () => {
        const fixture = await bettingFixture();
        await testDb('balance').update({ amount: 25, penalty: 0.4 });
        await testDb('loans').insert(getPastDeadlineTestLoanTemplate());
        await testDb.raw("ALTER TABLE transactions ADD CONSTRAINT reject_bankruptcy CHECK (type <> 'BANKRUPTCY')");
        const [result] = await Promise.allSettled([goBankrupt(fixture.userId, 0)]);
        expect(result.status).to.eq('rejected');
        expect(await testDb('balance').first()).to.include({ amount: 25, bankruptcy: 0, penalty: 0.4 });
        expect((await testDb('loans').first())?.payback).to.eq(LoanPayBack.UNRESOLVED);
        expect(await testDb('transactions')).to.have.length(0);
        await testDb.raw('ALTER TABLE transactions DROP CONSTRAINT reject_bankruptcy');
        await goBankrupt(fixture.userId, 0);
        expect((await testDb('loans').first())?.payback).to.eq(LoanPayBack.WIPED);
        expect(await testDb('balance').first()).to.include({ amount: 100, bankruptcy: 1 });
    });

    it('Serialises bankruptcy and a draft confirmation without double credit or deadlocks', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        const [bankrupt, confirmation] = await Promise.allSettled([
            goBankrupt(fixture.userId, 0),
            confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context),
        ]);
        expect(confirmation.status).to.eq('fulfilled');
        const balance = await testDb('balance').first();
        expect(balance?.amount).to.eq(90);
        expect(balance?.bankruptcy).to.eq(bankrupt.status === 'fulfilled' ? 1 : 0);
        expect((await testDb('bets').first())?.guess).to.eq(BetResult.WIN);
        expect(await testDb('transactions').where({ type: TransactionType.BET_PLACED })).to.have.length(1);
    });

    it('Wipes only this users unresolved loans and preserves other loan history', async () => {
        const fixture = await bettingFixture();
        await testDb('loans').insert([
            getPastDeadlineTestLoanTemplate(),
            getPastDeadlineTestLoanTemplate({ payback: LoanPayBack.RESOLVED }),
            getPastDeadlineTestLoanTemplate({ userId: 'someone-else' }),
        ]);
        await goBankrupt(fixture.userId, 0);
        const loans = await testDb('loans').orderBy('id');
        expect(loans.map((loan) => loan.payback)).to.deep.eq([
            LoanPayBack.WIPED,
            LoanPayBack.RESOLVED,
            LoanPayBack.UNRESOLVED,
        ]);
    });
});
