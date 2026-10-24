import { sandbox } from '../init.ts';
import { placeBet } from '../../../src/services/discord/commands/place-bet/place-bet.ts';
import { getTestGameTemplate, getTestInteraction, getTestTrackedPlayerTemplate } from '../../test-data.ts';
import { expect } from 'chai';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { ActionRowBuilder, MessageFlags, SelectMenuBuilder } from 'discord.js';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import nock from 'nock';
import { RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import { Interaction } from '../../../src/services/interaction.service.ts';
describe('Discord command - /place-bet', () => {
    const { execute } = placeBet;
    it('Should not allow to place a bet if there are no active games', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());
        const interaction = getTestInteraction();
        const deferSpy = sandbox.spy(interaction, 'deferReply');
        const spy = sandbox.spy(interaction, 'editReply');
        await execute(interaction);

        expect(deferSpy.calledOnceWith({ flags: MessageFlags.Ephemeral })).to.eq(true);
        expect(deferSpy.calledBefore(spy)).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Ei ole ühtegi mängu.',
            components: [],
        });
    });
    it('Should open bet amount selector', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'editReply');
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
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

        await execute(interaction);

        const amountMenu = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder()
                .setCustomId(Interaction.AMOUNT_SELECTED)
                .setPlaceholder('Panust ei ole!')
                .addOptions(
                    {
                        label: '10',
                        description: 'Panustad 10 muumimünti',
                        value: '10',
                    },
                    {
                        label: '20',
                        description: 'Panustad 20 muumimünti',
                        value: '20',
                    },
                    {
                        label: '50',
                        description: 'Panustad 50 muumimünti',
                        value: '50',
                    },
                    {
                        label: '100',
                        description: 'Panustad 100 muumimünti',
                        value: '100',
                    },
                    {
                        label: 'Muu kogus',
                        description: 'Panusta enda soovitud kogus',
                        value: 'custom',
                    },
                ),
        );
        expect(spy.args[0][0]).to.deep.equal({
            content: `Mängu aeg: **00:00**\nKoefitsent: **2**\nKontoseis: **100** muumimünti\nTee oma panus!`,
            components: [amountMenu],
        });
    });
    it('Should return odds = 2, if the gameStartTime is received as 0 from Riot API', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'editReply');
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
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
                gameStartTime: 0,
                gameLength: 0,
            });

        await execute(interaction);

        const amountMenu = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder()
                .setCustomId(Interaction.AMOUNT_SELECTED)
                .setPlaceholder('Panust ei ole!')
                .addOptions(
                    {
                        label: '10',
                        description: 'Panustad 10 muumimünti',
                        value: '10',
                    },
                    {
                        label: '20',
                        description: 'Panustad 20 muumimünti',
                        value: '20',
                    },
                    {
                        label: '50',
                        description: 'Panustad 50 muumimünti',
                        value: '50',
                    },
                    {
                        label: '100',
                        description: 'Panustad 100 muumimünti',
                        value: '100',
                    },
                    {
                        label: 'Muu kogus',
                        description: 'Panusta enda soovitud kogus',
                        value: 'custom',
                    },
                ),
        );
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Mängu aeg: **00:00**\nKoefitsent: **2**\nKontoseis: **100** muumimünti\nTee oma panus!`,
            components: [amountMenu],
        });
    });
    it('Should not allow to place a bet if game length has exceeded 24 minutes', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'editReply');
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
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
                gameStartTime: Date.now() - 1440000,
            });
        await execute(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Mängu aeg: **24:00**\n
                Mäng on kestnud liiga kaua, et panustada. Oota järgmist mängu!`,
            components: [],
        });
    });
});
