import {
    getTestBalanceTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
} from '../../test-data';
import { sandbox, testDb } from '../init';
import { amountSelectedCustom } from '../../../src/services/discord/interactions/betting/amountSelectedCustom';
import { expect } from 'chai';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Interaction } from '../../../src/services/interaction.service';
import { addPlayer } from '../../../src/database/queries/player.query';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import nock from 'nock';
import { RIOT_API_EUNE_URL } from '../../../src/services/riot-games/requests';

describe('Discord interaction - AMOUNT_SELECTED_CUSTOM', () => {
    it('Should not set custom amount if it is not a numeric value', async () => {
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
            content: 'Sisestage ainult number! Ärge kasutage muid sümboleid!',
            components: [],
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(0);
    });
    it('Should place a bet if a valid custom amount is entered', async () => {
        const betAmount = '2';
        const interaction = getTestInteraction({
            fields: {
                getTextInputValue: (_) => {
                    return betAmount;
                },
            },
        });
        const spy = sandbox.spy(interaction, 'update');
        const [player, game] = await Promise.all([
            addPlayer(getTestTrackedPlayerTemplate()),
            createSteveGame(getTestGameTemplate()),
            createUserBalance(getTestBalanceTemplate({ amount: 10 })),
        ]);
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, {
                gameId: game.gameId,
                mapId: 11,
                gameMode: 'CLASSIC',
                gameType: 'MATCHED_GAME',
                gameQueueConfigId: 400,
                participants: [],
                observers: { encryptionKey: 'l+tsbj7fKJse17NrtXsmcFFpGNBPpUYn' },
                platformId: 'EUN1',
                bannedChampions: [
                    { championId: 84, teamId: 100, pickTurn: 1 },
                    { championId: 53, teamId: 100, pickTurn: 2 },
                    { championId: 19, teamId: 100, pickTurn: 3 },
                    { championId: 122, teamId: 100, pickTurn: 4 },
                    { championId: 99, teamId: 100, pickTurn: 5 },
                    { championId: 266, teamId: 200, pickTurn: 6 },
                    { championId: -1, teamId: 200, pickTurn: 7 },
                    { championId: 99, teamId: 200, pickTurn: 8 },
                    { championId: 55, teamId: 200, pickTurn: 9 },
                    { championId: 157, teamId: 200, pickTurn: 10 },
                ],
                gameStartTime: Date.now(),
                gameLength: 0,
            });

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
        );
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad ${betAmount} muumimünti`,
            components: [rowButton],
            ephemeral: true,
        });
        const [bets, newBalance] = await Promise.all([testDb('bets'), testDb('balance').first()]);
        expect(bets.length).to.eq(1);
        expect(newBalance.amount).to.eq(8);
    });
});
