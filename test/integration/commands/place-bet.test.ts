import { sandbox } from '../init';
import { placeBet } from '../../../src/services/discord/commands/place-bet/place-bet';
import {
    TEST_TRACKED_PLAYER,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
} from '../../test-data';
import { expect } from 'chai';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { addPlayer } from '../../../src/database/queries/player.query';
import nock from 'nock';
import { RIOT_API_EUNE_URL, RIOT_API_EU_URL } from '../../../src/services/riot-games/requests';
import { Interaction } from '../../../src/services/interaction.service';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model';
describe('Discord command - /place-bet', () => {
    const { execute } = placeBet;
    it('Should not allow to place a bet if there are no active games', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${TEST_TRACKED_PLAYER.puuid}/ids`)
            .reply(300, ['EUN1_123456789']);
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);

        expect(spy.args[0][0]).to.deep.equal({ content: 'Ei ole ühtegi mängu.', components: [], ephemeral: true });
    });
    it('Should open bet amount selector', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${TEST_TRACKED_PLAYER.puuid}/ids`)
            .reply(300, ['EUN1_123456789']);
        nock(RIOT_API_EUNE_URL)
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
            ephemeral: true,
        });
    });
    it('Should return odds = 2, if the gameStartTime is received as 0 from Riot API', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${TEST_TRACKED_PLAYER.puuid}/ids`)
            .reply(200, ['EUN1_123456789', 'EUN1_213456789', 'EUN1_312456780', 'EUN1_412356789']);
        nock(RIOT_API_EUNE_URL)
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
            ephemeral: true,
        });
    });
    it('Should not allow to place a bet if game length has exceeded 24 minutes', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${TEST_TRACKED_PLAYER.puuid}/ids`)
            .reply(200, ['EUN1_123456789', 'EUN1_213456789', 'EUN1_312456780', 'EUN1_412356789']);
        nock(RIOT_API_EUNE_URL)
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
            ephemeral: true,
        });
    });

    it('Should finish old Steve games before user can place a bet', async () => {
        const interaction = getTestInteraction();
        await addPlayer(getTestTrackedPlayerTemplate());
        const oldSteveGame = await createSteveGame(
            getTestGameTemplate({
                gameId: '123456789',
                gameStart: 17141501990,
                gameStatus: SteveGameStatus.IN_PROGRESS,
            }),
        );
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${TEST_TRACKED_PLAYER.puuid}/ids`)
            .reply(200, ['EUN1_123456789', 'EUN1_213456789', 'EUN1_312456780', 'EUN1_412356789']);
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/EUN1_${oldSteveGame.gameId}`)
            .reply(200, {
                metadata: {
                    matchId: 'EUN1_123456789',
                    gameId: 'EUN1_123456789',
                    participants: [
                        '5XklTRT8CJ26bKMTG30DOcSUkSLgKv7FlOK1jDJI4WT4rxuIgesXWOImTiaf9MZ1a6eY8NpixAnG3w',
                        'wApfhBhMhdszrgIOOYX5gwYq1SY9dj4X1KPTyD0S6oEixqUpCUGi9zULNIK2SNVdf8lO9lU-KUDbGw',
                        'ka_tKHlu9UqTmfi75rSjC2BO4cR-sl9zYmGWFFSs5X9ZUdE34wAVMHbT8zhlay-CvoTUcBjbJ9fZyw',
                        'NnGdK8PD9gKaqSR6gHcLlbOE8BO39oY5gVXpcqcto06XmVZHf-eIEReD-A5jd6K6oClENDOopnN1Nw',
                        'F-UPH5lUzwWIy1UKu4SH-G_zLUGIcLMADbmcqMdGM0LIk2ILw6vh2IVSUaYb-pCuwZOg7eTjOKjk-Q',
                        'ZcebUtzNhAfMV32RCt9DGbFrluMSBEoBVqLMLJ5bt_2KMpkg2B6RZGyBZD_87oBueEJj7njr7Cm5xw',
                        'IrefWXTS2LWuAhPmLkKUzCkp6dG84hMYsDbekdquHw0cIj24tg485hF9u1L76mxNU3QChvTB8jrGfw',
                        'Ef-cj1XmFO8Ils2cE8ggHPk9_Ugjs24vUohzY-00MgkoTAJwpIlBXIzG7xie0OaRqBDXmL0ue54a5A',
                        'hQMOGOln4MchTENj3u4jWHt8DHtERn5r4ylR1UMn1y84AD_-apJMoxFj5KUfvtfTEf19guHBF7iPDQ',
                        'vbVn7oJVqq77Lr3EVsktl1_dWIb4jXJqArUBxLUKAIB8rSFLg_a3bYE-niRVvAC3MaZ4OM-bqhW4ug',
                    ],
                },
                info: {
                    endOfGameResult: 'GameComplete',
                    gameStartTimeStamp: 17141501990,
                    gameEndTimeStamp: 17141501890,
                    participants: [
                        {
                            puuid: 'Ef-cj1XmFO8Ils2cE8ggHPk9_Ugjs24vUohzY-00MgkoTAJwpIlBXIzG7xie0OaRqBDXmL0ue54a5A',
                            riotIdGameName: 'Loviatar',
                            riotIdTagline: '0001',
                            summonerId: 'oED5H6wEe9kzbstCh2yOL7cDOdKgHNXFBKVNhBr-360jVkk',
                            summonerLevel: 730,
                            summonerName: 'Loviatar',
                            win: true,
                        },
                    ],
                },
            });

        await execute(interaction);
    });
});
