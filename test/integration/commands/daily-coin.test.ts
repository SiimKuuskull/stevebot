import { expect } from 'chai';
import { Balance } from '../../../src/database/models/balance.model';
import { Transaction } from '../../../src/database/models/transactions.model';
import { DailyCoin } from '../../../src/database/models/dailyCoin.model';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createDailyCoin } from '../../../src/database/queries/dailyCoin.query';
import { dailyCoin } from '../../../src/services/discord/commands/daily-coin/daily-coin';
import {
    getTestBalanceTemplate,
    getTestDailyCoinTemplate,
    getTestInteraction,
    getTestTransactionTemplate,
} from '../../test-data';
import { sandbox, testDb } from '../init';
import { createTransaction } from '../../../src/database/queries/transactions.query';

describe('Discord command - /daily-coin', async () => {
    const { execute } = dailyCoin;
    it('Should create new balance for user, if there is none', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const balances = await testDb('balance');

        expect(balances.length).to.eq(1);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Ei leidnud aktiivset kontot! Tegime sulle uue konto, kontoseis: **100** muumimünti. :wink:`,
            ephemeral: true,
            components: [],
        });
    });
    it('Should update users balance if there is no previous record of using the command', async () => {
        const interaction = getTestInteraction();
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Väike Muum viskas su münditopsi **10** muumimünti. Tule homme tagasi!`,
            ephemeral: true,
        });
        const [balances, transactions, dailyCoins]: [Balance[], Transaction[], DailyCoin[]] = await Promise.all([
            testDb('balance'),
            testDb('transactions'),
            testDb('daily_coin'),
        ]);
        expect(balances[0].amount).to.eq(110);
        expect(transactions.length).to.eq(1);
        expect(transactions[0].id).to.eq(1);
        expect(dailyCoins.length).to.eq(1);
        expect(dailyCoins[0].transactionId).to.eq(1);
    });
    it('Should update users balance if more than 24 hours has passed since last use of /daily-coin', async () => {
        const interaction = getTestInteraction();
        await createUserBalance(
            getTestBalanceTemplate({ amount: 110, dailyCoin: new Date('2021-11-06T15:10:47.229Z') }),
        );
        const transaction = await createTransaction(getTestTransactionTemplate());
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
        const [balances, transactions, dailyCoins]: [Balance[], Transaction[], DailyCoin[]] = await Promise.all([
            testDb('balance'),
            testDb('transactions'),
            testDb('daily_coin').orderBy('createdAt', 'desc'),
        ]);
        expect(balances[0].amount).to.eq(120);
        expect(transactions.length).to.eq(2);
        expect(dailyCoins.length).to.eq(2);
        expect(dailyCoins[0].transactionId).to.eq(2);
    });
    it('Should not update users balance if less than 24 hours has passed since last use of /daily-coin', async () => {
        const interaction = getTestInteraction();
        const date = new Date();
        date.setHours(date.getHours() - 2);
        await createUserBalance(getTestBalanceTemplate({ amount: 100, dailyCoin: date }));
        await createDailyCoin(getTestDailyCoinTemplate({ createdAt: date }));
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Raputad oma münditopsi, aga ei kõlise. Tule proovi hiljem uuesti!\n
                Pead ootama veel **21** tundi ja **59** minutit :hourglass:`,
            ephemeral: true,
        });
        const balances = await testDb('balance').where({ amount: 100 });
        expect(balances.length).to.eq(1);
    });
});
