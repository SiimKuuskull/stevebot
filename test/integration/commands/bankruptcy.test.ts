import { expect } from 'chai';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { BetResult } from '../../../src/database/models/bet.model';
import { createBet } from '../../../src/database/queries/bets.query';
import { bankruptcy } from '../../../src/services/discord/commands/bankruptcy/bankruptcy';
import { Interaction } from '../../../src/services/interaction.service';
import { getTestBetTemplate, getTestInteraction, getTestTransactionTemplate } from '../../test-data';
import { sandbox, testDb } from '../init';
import { ButtonStyle } from 'discord.js';
import { useBettingAccount } from '../../../src/services/registration.service';
import { makeTransaction } from '../../../src/services/transaction.service';
import { TransactionType } from '../../../src/database/models/transactions.model';

describe('Discord command - /bankruptcy', () => {
    const { execute } = bankruptcy;
    it('Should create a balance if no balance is found.', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad **100** muumimünti enda uuele kontole. GL!`,
            ephemeral: true,
        });
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
    });
    it(`Should not allow to declare bankruptcy, if user has >= 9 bankruptcy`, async () => {
        const interaction = getTestInteraction();
        const { balance } = await useBettingAccount(interaction.user);
        await testDb('balance').where({ id: balance.id }).update('bankruptcy', 9);
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Suur Muum ei rahulda su pankrotiavaldust ja soovitab majandusliku abi otsida mujalt`,
            components: [],
            ephemeral: true,
        });
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
        expect(balances[0].bankruptcy).to.eq(9);
    });
    it('Should not allow to declare bankruptcy if there is an active bet', async () => {
        const interaction = getTestInteraction();
        const { balance } = await useBettingAccount(interaction.user);
        await createBet(getTestBetTemplate({ result: BetResult.IN_PROGRESS }));
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Sul on hetkel veel aktiivseid panuseid. Oota mängu lõppu ja proovi uuesti!`,
            components: [],
            ephemeral: true,
        });
        const balances = await testDb('balance');
        const bets = await testDb('bets').where({ result: BetResult.IN_PROGRESS });
        expect(balances.length).to.eq(1);
        expect(balance.bankruptcy).to.lessThan(9);
        expect(bets.length).to.eq(1);
    });
    it('Should declare bankruptcy if there is no active game and balance is less than 0', async () => {
        const interaction = getTestInteraction();
        await useBettingAccount(interaction.user);

        const bet = await createBet(getTestBetTemplate({ result: BetResult.WIN }));
        await makeTransaction(
            getTestTransactionTemplate({
                type: TransactionType.BET_PLACED,
                amount: -100,
                externalTransactionId: bet.id,
            }),
        );
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
        expect(balances[0].amount).to.eq(100);
        expect(balances[0].bankruptcy).to.eq(1);
    });
    it('Should show buttons when you declare bankruptcy while having a balance greater than 0', async () => {
        const interaction = getTestInteraction();
        await useBettingAccount(interaction.user);
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const rowButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(Interaction.BANKRUPTCY_DECLARED)
                .setLabel('Jah, pankrot')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(Interaction.BANKRUPTCY_DENIED)
                .setLabel('Ei, mõtlesin ümber')
                .setStyle(ButtonStyle.Danger),
        );
        expect(spy.args[0][0]).to.deep.equal({
            content: `Oled valinud välja kuulutada pankroti! Kas oled oma otsuses kindel?\n\n            Sellest otsusest enam tagasi astuda _**EI**_ ole võimalik! `,
            components: [rowButtons],
            ephemeral: true,
        });

        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
        expect(balances[0].amount).to.eq(100);
        expect(balances[0].bankruptcy).to.eq(0);
    });
});
