import { expect } from 'chai';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { TransactionType } from '../../../src/database/models/transactions.model.ts';
import {
    cancelBettingDraft,
    confirmBet,
    EXPIRED_BET_MESSAGE,
    startBettingDraft,
} from '../../../src/services/bet.service.ts';
import { guessSelected } from '../../../src/services/discord/interactions/betting/guessSelected.ts';
import { Interaction } from '../../../src/services/interaction.service.ts';
import { getTestInteraction } from '../../test-data.ts';
import { bettingFixture, mockLiveGame } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

describe('Discord interaction - game-bound bet confirmation', () => {
    for (const guess of [BetResult.WIN, BetResult.LOSE] as const) {
        it(`Confirms ${guess} for the selected player and records exactly one debit`, async () => {
            const fixture = await bettingFixture({ amount: 10 });
            const other = await bettingFixture({ suffix: 'other', amount: 20 });
            mockLiveGame(fixture);
            const interaction = getTestInteraction({
                customId: fixture.customId(guess === BetResult.WIN ? Interaction.BET_WIN : Interaction.BET_LOSE, 2),
            });
            const reply = sandbox.spy(interaction, 'editReply');
            await guessSelected(interaction);
            expect(reply.firstCall.args[0].content).to.include('Player-first').and.include('**10**');
            expect((await testDb('bets').where({ id: fixture.bet.id }).first())?.guess).to.eq(guess);
            expect((await testDb('bets').where({ id: other.bet.id }).first())?.guess).to.eq(BetResult.IN_PROGRESS);
            expect((await testDb('balance').first())?.amount).to.eq(90);
            const transactions = await testDb('transactions');
            expect(transactions).to.have.length(1);
            expect(transactions[0]).to.include({
                amount: -10,
                balance: 90,
                externalTransactionId: fixture.bet.id,
                type: TransactionType.BET_PLACED,
            });

            await guessSelected(interaction);
            expect(reply.secondCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
            expect(await testDb('transactions')).to.have.length(1);
        });
    }

    for (const team of [100, 200]) {
        it(`Rejects a forged forbidden guess for team ${team} even if the button was hidden`, async () => {
            const fixture = await bettingFixture({ amount: 10, team });
            mockLiveGame(fixture);
            const interaction = getTestInteraction({
                customId: fixture.customId(team === 100 ? Interaction.BET_LOSE : Interaction.BET_WIN, 2),
            });
            const reply = sandbox.spy(interaction, 'editReply');
            await guessSelected(interaction);
            expect(reply.firstCall.args[0].content).to.include('oma meeskonna vastu');
            expect((await testDb('bets').first())?.guess).to.eq(BetResult.IN_PROGRESS);
            expect((await testDb('balance').first())?.amount).to.eq(100);
            expect(await testDb('transactions')).to.have.length(0);
        });
    }

    it('Shows changed odds without charging, and requires the newly quoted button', async () => {
        const fixture = await bettingFixture({ amount: 10, startTime: Date.now() - 10 * 60000 });
        mockLiveGame(fixture, { times: 3 });
        const interaction = getTestInteraction({ customId: fixture.customId(Interaction.BET_WIN, 2) });
        const reply = sandbox.spy(interaction, 'editReply');
        await guessSelected(interaction);
        expect(reply.firstCall.args[0].content).to.include('Koefitsent muutus');
        const newButton = reply.firstCall.args[0].components[0].toJSON().components[0].custom_id;
        expect(newButton).to.eq(fixture.customId(Interaction.BET_WIN, 1.6));
        await guessSelected(interaction);
        expect(await testDb('transactions')).to.have.length(0);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        await guessSelected(getTestInteraction({ customId: newButton }));
        expect((await testDb('balance').first())?.amount).to.eq(90);
        expect(await testDb('bets').first()).to.include({ guess: BetResult.WIN, odds: 1.6 });
    });

    it('Rejects a draft at exactly 60 seconds without touching other drafts', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        const now = Date.now();
        sandbox.useFakeTimers({ now, toFake: ['Date'] });
        await testDb('bets')
            .where({ id: fixture.bet.id })
            .update({ createdAt: new Date(now - 60000) });
        const interaction = getTestInteraction({ customId: fixture.customId(Interaction.BET_WIN, 2) });
        const reply = sandbox.spy(interaction, 'editReply');
        await guessSelected(interaction);
        expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Rechecks the 24 minute window at confirmation', async () => {
        const fixture = await bettingFixture({ amount: 10, startTime: Date.now() - 24 * 60000 });
        mockLiveGame(fixture);
        const interaction = getTestInteraction({ customId: fixture.customId(Interaction.BET_WIN, 2) });
        const reply = sandbox.spy(interaction, 'editReply');
        await guessSelected(interaction);
        expect(reply.firstCall.args[0].content).to.include('liiga kaua');
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Rejects legacy and malformed confirmation IDs without inferring a current game', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        for (const customId of [
            'BET_WIN',
            `BET_WIN:${fixture.game.id}:${fixture.bet.id}`,
            `BET_WIN:${fixture.game.id}:${fixture.bet.id}:Infinity`,
        ]) {
            const interaction = getTestInteraction({ customId });
            const reply = sandbox.spy(interaction, 'editReply');
            await guessSelected(interaction);
            expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
        }
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Cancels only the chosen draft without a Riot request or a balance change', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        const other = await bettingFixture({ suffix: 'other', amount: 20 });
        await guessSelected(getTestInteraction({ customId: fixture.customId(Interaction.BET_CANCEL) }));
        expect(await testDb('bets').where({ id: fixture.bet.id }).first()).to.eq(undefined);
        expect(await testDb('bets').where({ id: other.bet.id }).first()).not.to.eq(undefined);
        expect((await testDb('balance').first())?.amount).to.eq(100);
    });

    it('Cannot cancel another user draft, a confirmed bet, or a refunded bet', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        let result = await Promise.allSettled([cancelBettingDraft('someone-else', fixture.reference)]);
        expect(result[0].status).to.eq('rejected');
        await testDb('bets').where({ id: fixture.bet.id }).update({ guess: BetResult.WIN });
        result = await Promise.allSettled([cancelBettingDraft(fixture.userId, fixture.reference)]);
        expect(result[0].status).to.eq('rejected');
        await testDb('bets')
            .where({ id: fixture.bet.id })
            .update({ guess: BetResult.IN_PROGRESS, result: BetResult.VOID });
        result = await Promise.allSettled([cancelBettingDraft(fixture.userId, fixture.reference)]);
        expect(result[0].status).to.eq('rejected');
        expect(await testDb('bets')).to.have.length(1);
    });
});

describe('Bet placement transaction guarantees', () => {
    for (const waitMs of [31000, 60000]) {
        it(`Rechecks odds and draft expiry after waiting ${waitMs}ms for another balance transaction`, async () => {
            const fixture = await bettingFixture({ amount: 10, startTime: Date.now() - 7.5 * 60000 });
            const blocker = await testDb.transaction();
            await blocker('balance').where({ userId: fixture.userId }).first().forUpdate();
            let reachedBalance!: () => void;
            const waiting = new Promise<void>((resolve) => {
                reachedBalance = resolve;
            });
            const onQuery = (query: { sql: string }) => {
                if (query.sql.includes('from "balance"') && query.sql.endsWith('for update')) {
                    reachedBalance();
                }
            };
            testDb.on('query', onQuery);
            try {
                const confirmation = Promise.allSettled([
                    confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context),
                ]);
                await waiting;
                sandbox.useFakeTimers({ now: fixture.bet.createdAt.getTime() + waitMs, toFake: ['Date'] });
                await blocker.commit();
                const [result] = await confirmation;
                if (waitMs === 60000) {
                    expect(result.status).to.eq('rejected');
                } else {
                    expect(result.status).to.eq('fulfilled');
                    if (result.status === 'fulfilled') {
                        expect(result.value.confirmed).to.eq(false);
                        expect(result.value.bet.odds).to.eq(1.6);
                    }
                }
                expect((await testDb('balance').first())?.amount).to.eq(100);
                expect(await testDb('transactions')).to.have.length(0);
            } finally {
                testDb.off('query', onQuery);
                if (!blocker.isCompleted()) {
                    await blocker.rollback();
                }
            }
        });
    }

    it('Charges once when WIN and LOSE confirmations race on the same draft', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        const results = await Promise.allSettled([
            confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context),
            confirmBet(fixture.userId, fixture.reference, BetResult.LOSE, 2, fixture.context),
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(90);
        expect(await testDb('transactions')).to.have.length(1);
        expect([BetResult.WIN, BetResult.LOSE]).to.include((await testDb('bets').first())?.guess);
    });

    it('Prevents overspending when two games are confirmed concurrently', async () => {
        const first = await bettingFixture({ amount: 80 });
        const second = await bettingFixture({ suffix: 'second', amount: 80 });
        const results = await Promise.allSettled(
            [first, second].map((fixture) =>
                confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context),
            ),
        );
        expect(results.filter((result) => result.status === 'fulfilled')).to.have.length(1);
        expect((await testDb('balance').first())?.amount).to.eq(20);
        expect(await testDb('bets').where({ guess: BetResult.WIN })).to.have.length(1);
        expect(await testDb('bets').where({ guess: BetResult.IN_PROGRESS })).to.have.length(1);
        expect(await testDb('transactions')).to.have.length(1);
    });

    it('Rolls back both the debit and decision if writing the ledger fails, allowing a safe retry', async () => {
        const fixture = await bettingFixture({ amount: 10 });
        await testDb.raw("ALTER TABLE transactions ADD CONSTRAINT reject_test_bet CHECK (type <> 'BET_PLACED')");
        const [result] = await Promise.allSettled([
            confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context),
        ]);
        expect(result.status).to.eq('rejected');
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect((await testDb('bets').first())?.guess).to.eq(BetResult.IN_PROGRESS);
        expect(await testDb('transactions')).to.have.length(0);
        await testDb.raw('ALTER TABLE transactions DROP CONSTRAINT reject_test_bet');
        expect(
            (await confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context)).confirmed,
        ).to.eq(true);
        expect((await testDb('balance').first())?.amount).to.eq(90);
    });

    for (const state of ['completed', 'void', 'untracked', 'moved-region', 'refunded'] as const) {
        it(`Rejects cached context when the game or player becomes ${state} before the transaction`, async () => {
            const fixture = await bettingFixture({ amount: 10 });
            if (state === 'completed' || state === 'void') {
                await testDb('steve_games').update({
                    gameStatus: state === 'completed' ? SteveGameStatus.COMPLETED : SteveGameStatus.VOID,
                });
            }
            if (state === 'untracked') {
                await testDb('player').update({ isTracked: false });
            }
            if (state === 'moved-region') {
                await testDb('player').update({ platformId: 'EUW1' });
            }
            if (state === 'refunded') {
                await testDb('bets').update({ result: BetResult.VOID });
            }
            const [result] = await Promise.allSettled([
                confirmBet(fixture.userId, fixture.reference, BetResult.WIN, 2, fixture.context),
            ]);
            expect(result.status).to.eq('rejected');
            expect((await testDb('balance').first())?.amount).to.eq(100);
            expect(await testDb('transactions')).to.have.length(0);
        });
    }

    it('Keeps one draft when two starts race and invalidates the replaced draft ID', async () => {
        const fixture = await bettingFixture();
        const drafts = await Promise.all([
            startBettingDraft(fixture.userId, fixture.context),
            startBettingDraft(fixture.userId, fixture.context),
        ]);
        const stored = await testDb('bets');
        expect(stored).to.have.length(1);
        expect(drafts.map((bet) => bet.id)).to.include(stored[0].id);
        expect(stored[0].id).not.to.eq(fixture.bet.id);
    });
});
