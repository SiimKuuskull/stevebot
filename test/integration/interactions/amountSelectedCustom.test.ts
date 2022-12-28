import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameMetaTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
    getTestUserTemplate,
    TEST_DISCORD_USER,
} from '../../test-data';
import { sandbox, testDb } from '../init';
import { amountSelectedCustom } from '../../../src/services/discord/interactions/betting/amountSelectedCustom';
import { expect } from 'chai';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Interaction } from '../../../src/services/interaction.service';
import { addPlayer } from '../../../src/database/queries/player.query';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createBet } from '../../../src/database/queries/bets.query';
import { createGameMeta } from '../../../src/database/queries/gameMeta.query';
import { createUser } from '../../../src/database/queries/users.query';

describe('Discord interaction - AMOUNT_SELECTED_CUSTOM', () => {
    it('Should not set custom amount if it is not a numeric value', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        await createGameMeta(getTestGameMetaTemplate(game.id));
        const interaction = getTestInteraction({
            fields: {
                getTextInputValue: (_) => {
                    return 'lammas';
                },
            },
        });
        const spy = sandbox.spy(interaction, 'reply');

        await amountSelectedCustom(interaction);
        expect(spy.calledOnce).to.eq(true);

        expect(spy.args[0][0]).to.deep.equal({
            content:
                'Sisestage ainult number! Ärge kasutage muid sümboleid! Veenduge, et panus on suurem, kui 0 :wink: ',
            components: [],
            ephemeral: true,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(0);
    });
    it('Should place a bet if a valid custom amount is entered', async () => {
        const betAmount = 2;
        await createBet(getTestBetTemplate({ amount: betAmount }));
        const interaction = getTestInteraction({
            fields: {
                getTextInputValue: (_) => {
                    return betAmount;
                },
            },
        });
        const spy = sandbox.spy(interaction, 'update');
        await createUserBalance(
            getTestBalanceTemplate({ userId: TEST_DISCORD_USER.id, userName: TEST_DISCORD_USER.tag, amount: 100 }),
        );
        const [game] = await Promise.all([
            createSteveGame(getTestGameTemplate()),
            addPlayer(getTestTrackedPlayerTemplate()),
            createUser(getTestUserTemplate()),
        ]);
        await createGameMeta(getTestGameMetaTemplate(game.id));

        await amountSelectedCustom(interaction);

        const rowButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(Interaction.BET_WIN)
                .setLabel('Steve VÕIDAB!')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_LOSE)
                .setLabel('Steve KAOTAB!')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_CANCEL)
                .setLabel('Tühista panus!')
                .setStyle(ButtonStyle.Secondary),
        );
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad **${betAmount}** muumimünti`,
            components: [rowButton],
            ephemeral: true,
        });
        const bets = await testDb('bets').whereNot({ amount: 0 });
        expect(bets.length).to.eq(1);
    });
    it('Should update odds and notify the user, if during betting the odds have changed', async () => {
        const [game] = await Promise.all([
            createSteveGame(getTestGameTemplate({ gameStart: Date.now() - 544900 })),
            addPlayer(getTestTrackedPlayerTemplate()),
            createUser(getTestUserTemplate()),
        ]);
        await createGameMeta(getTestGameMetaTemplate(game.id));
        const betAmount = 2;
        await createBet(getTestBetTemplate({ amount: betAmount }));
        const interaction = getTestInteraction({
            fields: {
                getTextInputValue: (_) => {
                    return betAmount;
                },
            },
        });
        const spy = sandbox.spy(interaction, 'update');
        await createUserBalance(
            getTestBalanceTemplate({ userId: TEST_DISCORD_USER.id, userName: TEST_DISCORD_USER.tag, amount: 100 }),
        );

        await amountSelectedCustom(interaction);

        const rowButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(Interaction.BET_WIN)
                .setLabel('Steve VÕIDAB!')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_LOSE)
                .setLabel('Steve KAOTAB!')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_CANCEL)
                .setLabel('Tühista panus!')
                .setStyle(ButtonStyle.Secondary),
        );
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad **2** muumimünti. **NB! Koefitsenti kohandati**. Uus koefitsent: **1.6**`,
            components: [rowButton],
            ephemeral: true,
        });
        const bets = await testDb('bets').whereNot({ amount: 0, odds: 2 });
        expect(bets.length).to.eq(1);
    });
    it('Should not display bet LOSE button if customer is in the same team as the player', async () => {
        const betAmount = 2;
        const [game] = await Promise.all([
            createSteveGame(getTestGameTemplate()),
            addPlayer(getTestTrackedPlayerTemplate()),
            createUserBalance(getTestBalanceTemplate()),
            createUser(
                getTestUserTemplate({
                    summonerName: 'Mìhkel',
                    summonerId: 'XGO_nv1F4Wl_1Mai-mAaPSdJCH9Mv52lg_ws2JwdoRg7Ipo',
                }),
            ),
            createBet(getTestBetTemplate({ amount: betAmount })),
        ]);
        await createGameMeta(getTestGameMetaTemplate(game.id));
        const interaction = getTestInteraction({
            fields: {
                getTextInputValue: (_) => {
                    return betAmount;
                },
            },
        });
        const spy = sandbox.spy(interaction, 'update');
        await amountSelectedCustom(interaction);

        const rowButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(Interaction.BET_WIN)
                .setLabel('Steve VÕIDAB!')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_CANCEL)
                .setLabel('Tühista panus!')
                .setStyle(ButtonStyle.Secondary),
        );
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad **2** muumimünti`,
            components: [rowButton],
            ephemeral: true,
        });
    });
    it('Should not display bet WIN button if the customer is in the opposing team of the player', async () => {
        const betAmount = 2;
        const [game] = await Promise.all([
            createSteveGame(getTestGameTemplate()),
            addPlayer(getTestTrackedPlayerTemplate()),
            createUserBalance(getTestBalanceTemplate()),
            createUser(
                getTestUserTemplate({
                    summonerName: 'jumpermaku',
                    summonerId: 'CFjGY_Rgw-AOzEbuIU8EE6ly8UZNRxpfVj7T4vGLeli3GVo',
                }),
            ),
            createBet(getTestBetTemplate({ amount: betAmount })),
        ]);
        await createGameMeta(getTestGameMetaTemplate(game.id));
        const interaction = getTestInteraction({
            fields: {
                getTextInputValue: (_) => {
                    return betAmount;
                },
            },
        });
        const spy = sandbox.spy(interaction, 'update');
        await amountSelectedCustom(interaction);

        const rowButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(Interaction.BET_LOSE)
                .setLabel('Steve KAOTAB!')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(Interaction.BET_CANCEL)
                .setLabel('Tühista panus!')
                .setStyle(ButtonStyle.Secondary),
        );
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad **2** muumimünti`,
            components: [rowButton],
            ephemeral: true,
        });
    });
});
