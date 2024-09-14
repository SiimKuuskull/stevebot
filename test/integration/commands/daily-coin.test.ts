import { expect } from 'chai';
import { TransactionType } from '../../../src/database/models/transactions.model';
import { updateBalance } from '../../../src/database/queries/balance.query';
import { createDailyCoin } from '../../../src/database/queries/dailyCoin.query';
import { dailyCoin } from '../../../src/services/discord/commands/daily-coin/daily-coin';
import { getTestDailyCoinTemplate, getTestInteraction, getTestTransactionTemplate } from '../../test-data';
import { sandbox, testDb } from '../init';
import { createTransaction } from '../../../src/database/queries/transactions.query';
import { useBettingAccount } from '../../../src/services/registration.service';

describe('Discord command - /daily-coin', () => {
    const { execute } = dailyCoin;
    it('Should create new balance for user, if there is none', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const [balances, transactions, user] = await Promise.all([
            testDb('balance'),
            testDb('transactions').orderBy('createdAt', 'asc'),
            testDb('users').first(),
        ]);

        expect(balances.length).to.eq(1);
        expect(balances[0].amount).to.eq(110);
        expect(transactions.length).to.eq(2);
        expect(transactions[0]).to.deep.include({
            amount: 100,
            type: TransactionType.BALANCE_CREATED,
        });
        expect(transactions[1]).to.deep.includes({
            amount: 10,
            type: TransactionType.DAILY_COIN,
        });
        expect(user.name).to.eq(interaction.user.tag);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Väike Muum viskas su münditopsi **10** muumimünti. Tule homme tagasi!`,
            ephemeral: true,
        });
    });
    it('Should update users balance if there is no previous record of using the command', async () => {
        const interaction = getTestInteraction();
        await useBettingAccount(interaction.user);
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Väike Muum viskas su münditopsi **10** muumimünti. Tule homme tagasi!`,
            ephemeral: true,
        });
        const [balances, transaction, dailyCoins] = await Promise.all([
            testDb('balance'),
            testDb('transactions').where('type', TransactionType.DAILY_COIN).first(),
            testDb('daily_coin'),
        ]);
        expect(balances[0].amount).to.eq(110);
        expect(transaction.amount).to.eq(10);
        expect(dailyCoins.length).to.eq(1);
        expect(dailyCoins[0].transactionId).to.eq(transaction.id);
    });
    it('Should update users balance if more than 24 hours has passed since last use of /daily-coin', async () => {
        const interaction = getTestInteraction();
        const { balance } = await useBettingAccount(interaction.user);
        const [transaction] = await Promise.all([
            createTransaction(getTestTransactionTemplate()),
            updateBalance(balance.userId, 10),
        ]);
        await createDailyCoin(
            getTestDailyCoinTemplate({
                createdAt: new Date('2021-11-07T15:10:47.229Z'),
                transactionId: transaction.id,
            }),
        );
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Väike Muum viskas su münditopsi **10** muumimünti. Tule homme tagasi!`,
            ephemeral: true,
        });
        const [balances, todaysTransaction, dailyCoins] = await Promise.all([
            testDb('balance'),
            testDb('transactions').orderBy('createdAt', 'desc').first(),
            testDb('daily_coin').orderBy('createdAt', 'desc'),
        ]);
        expect(balances[0].amount).to.eq(120);
        expect(todaysTransaction.amount).to.eq(10);
        expect(dailyCoins.length).to.eq(2);
        expect(dailyCoins[0].transactionId).to.eq(todaysTransaction.id);
    });
    it('Should not update users balance if less than 24 hours has passed since last use of /daily-coin', async () => {
        const interaction = getTestInteraction();
        const date = new Date();
        date.setHours(date.getHours() - 2);
        const { balance } = await useBettingAccount(interaction.user);
        await Promise.all([createTransaction(getTestTransactionTemplate()), updateBalance(balance.userId, 10)]);
        await createDailyCoin(getTestDailyCoinTemplate({ createdAt: date }));
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Raputad oma münditopsi, aga ei kõlise. Tule proovi hiljem uuesti!\n
                Pead ootama veel **21** tundi ja **59** minutit :hourglass:`,
            ephemeral: true,
        });
        const balances = await testDb('balance').where({ amount: 110 });
        expect(balances.length).to.eq(1);
    });
});
