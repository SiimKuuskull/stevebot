import { expect } from 'chai';
import { ActionRowBuilder, ButtonBuilder } from '@discordjs/builders';
import { BetResult } from '../../../src/database/models/bet.model';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createBet } from '../../../src/database/queries/bets.query';
import { bankruptcy } from '../../../src/services/discord/commands/bankruptcy/bankruptcy';
import { Interaction } from '../../../src/services/interaction.service';
import { enableLogs } from '../../../src/tools/logger';
import { getTestBalanceTemplate, getTestBetTemplate, getTestInteraction } from '../../test-data';
import { sandbox, testDb } from '../init';
import { ButtonStyle } from 'discord.js';

describe('Discord command - /bankruptcy', () => {
    const { execute } = bankruptcy;
    it('Should create a balance if no balance is found.', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);
        
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Ei leidnud sinu nimel aktiivset kontot. Seega saad 100 muumimünti enda uuele kontole. GL!`,
            ephemeral: true,
        });
        const balances = await testDb('balance');
        expect(balances.length).to.eq(1);
    });
    it(`Should not allow to declare bankruptcy, if user has >= 9 bankruptcy`, async () => {
        const balance = await createUserBalance(getTestBalanceTemplate({ bankruptcy: 9 }));
        const interaction = getTestInteraction();
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
        expect(balance.bankruptcy).to.greaterThanOrEqual(9);
    });
    it('Should not allow to declare bankruptcy if there is an active bet', async () => {
        const balance = await createUserBalance(getTestBalanceTemplate({ bankruptcy: 0, amount: 100 }));
        const interaction = getTestInteraction();
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
        const balance = await createUserBalance(getTestBalanceTemplate({ bankruptcy: 0, amount: 0 }));
        const interaction = getTestInteraction();
        await createBet(getTestBetTemplate({ result: BetResult.WIN }));
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        const balances = await testDb('balance');
        const bets = await testDb('bets').where({ result: BetResult.IN_PROGRESS });
        expect(balances.length).to.eq(1);
        expect(balance.amount).to.lessThanOrEqual(0);
        expect(balance.bankruptcy).to.lessThan(9);
        expect(bets.length).to.eq(0);
    });
    it('Should show buttons when you declare bankruptcy while having a balance greater than 0', async () => {
        const balance = await createUserBalance(getTestBalanceTemplate({ bankruptcy: 0, amount: 50 }));
        const interaction = getTestInteraction();
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
            content: `Oled valinud välja kuulutada pankroti! Kas oled oma otsuses kindel?\n
            Sellest otsusest enam tagasi astuda ei ole võimalik! `,
            components: [rowButtons],
            ephemeral: true,
        });

        const balances = await testDb('balance');
        const bets = await testDb('bets').where({ result: BetResult.IN_PROGRESS });
        expect(bets.length).to.eq(0);
        expect(balances.length).to.eq(1);
        expect(balance.amount).to.greaterThan(0);
        expect(balance.bankruptcy).to.lessThan(9);
    });
});
