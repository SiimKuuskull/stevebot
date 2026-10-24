import { sandbox, testDb } from '../init.ts';
import { amountSelected } from '../../../src/services/discord/interactions/betting/amountSelected.ts';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameMetaTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
    getTestUserTemplate,
    TEST_DISCORD_USER,
    TEST_TRACKED_PLAYER,
} from '../../test-data.ts';
import { expect } from 'chai';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import nock from 'nock';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { createBet } from '../../../src/database/queries/bets.query.ts';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { Interaction } from '../../../src/services/interaction.service.ts';
import { createUserBalance } from '../../../src/database/queries/balance.query.ts';
import { DateTime } from 'luxon';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { createGameMeta } from '../../../src/database/queries/gameMeta.query.ts';
import { createUser } from '../../../src/database/queries/users.query.ts';
import { displayBettingButtons } from '../../../src/services/discord/components/betDecision.ts';

describe('Discord interaction - AMOUNT_SELECTED', () => {
    describe('Bet decision buttons', () => {
        const scenarios = [
            {
                name: 'allow betting on win when the betting player is on the same team as the tracked player',
                participantIndex: 1,
                outcome: Interaction.BET_WIN,
                allowed: true,
            },
            {
                name: 'not allow betting on lose when the betting player is on the same team as the tracked player',
                participantIndex: 1,
                outcome: Interaction.BET_LOSE,
                allowed: false,
            },
            {
                name: 'not allow betting on win when the betting player is on the opposing team to the tracked player',
                participantIndex: 2,
                outcome: Interaction.BET_WIN,
                allowed: false,
            },
            {
                name: 'allow betting on lose when the betting player is on the opposing team to the tracked player',
                participantIndex: 2,
                outcome: Interaction.BET_LOSE,
                allowed: true,
            },
            {
                name: 'allow betting on win when the betting player is a spectator',
                participantIndex: -1,
                outcome: Interaction.BET_WIN,
                allowed: true,
            },
            {
                name: 'allow betting on lose when the betting player is a spectator',
                participantIndex: -1,
                outcome: Interaction.BET_LOSE,
                allowed: true,
            },
        ];

        for (const scenario of scenarios) {
            it(`Should ${scenario.name}`, async () => {
                const game = await createSteveGame(getTestGameTemplate());
                const gameMeta = getTestGameMetaTemplate(game.id);
                const participants = gameMeta.meta!.participants;
                const puuid = participants[scenario.participantIndex]?.puuid;
                await createGameMeta(gameMeta);
                await createUser(getTestUserTemplate(puuid ? { puuid } : undefined));
                await createBet(getTestBetTemplate({ gameId: game.gameId }));
                const interaction = getTestInteraction();
                const spy = sandbox.spy(interaction, 'update');

                await displayBettingButtons(interaction, 10, game, TEST_TRACKED_PLAYER.puuid);

                expect(spy.calledOnce).to.eq(true);
                const row: ActionRowBuilder<ButtonBuilder> = spy.firstCall.args[0].components[0];
                const buttons = row.toJSON().components;
                const buttonIds = buttons.map((button) => ('custom_id' in button ? button.custom_id : undefined));
                expect(buttonIds.includes(scenario.outcome)).to.eq(scenario.allowed);
                expect(buttonIds).to.include(Interaction.BET_CANCEL);
            });
        }
    });

    it('Should not allow betting if no active game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        nock(RIOT_PLATFORM_URL.EUN1).get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`).reply(404, {
            httpStatus: 404,
            errorCode: 'NOT_FOUND',
            message: "spectator game info isn't found",
            implementationDetails: 'filtered',
        });

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(0);
    });
    it('Should not allow multiple bets on 1 game per user', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId, guess: BetResult.LOSE }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, {
                gameId: 3218543000,
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
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, []);

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':older_man: | Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(1);
        expect(bets[0].id).to.eq(bet.id);
    });
    it('Should not allow to bet on a finished game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ gameResult: true }));
        await createBet(getTestBetTemplate({ amount: 0, gameId: game.gameId, guess: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
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
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, [`EUN1_${game.gameId}`]);
        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(0);
    });
    it('Should trigger custom bet modal', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const bet = await createBet(getTestBetTemplate({ amount: 0, guess: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction({ values: 'custom' });
        const showModalSpy = sandbox.spy(interaction, 'showModal');
        const editReplySpy = sandbox.spy(interaction, 'editReply');
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
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, []);

        await amountSelected(interaction);

        expect(showModalSpy.calledOnce).to.eq(true);
        expect(editReplySpy.calledOnce).to.eq(true);
        expect(editReplySpy.args[0][0]).to.deep.equal({
            content: `Valisid muu koguse panustamise! Palun sisesta enda soovitud panus!`,
            components: [],
            flags: MessageFlags.Ephemeral,
        });

        const bets = await testDb('bets');
        expect(bets.length).to.eq(1);
        expect(bets[0].amount).to.eq(bet.amount);
    });
    it('Should place a bet', async () => {
        await createUserBalance(
            getTestBalanceTemplate({ userId: TEST_DISCORD_USER.id, userName: TEST_DISCORD_USER.tag, amount: 100 }),
        );
        await createUser(getTestUserTemplate());
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        await createGameMeta(getTestGameMetaTemplate(game.id));
        await createBet(getTestBetTemplate({ amount: 0 }));
        const interaction = getTestInteraction({ values: '10' });
        const spy = sandbox.spy(interaction, 'update');
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
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, []);

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
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

        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad **10** muumimünti`,
            components: [rowButton],
            flags: MessageFlags.Ephemeral,
        });

        const bets = await testDb('bets');
        expect(bets.length).to.eq(1);
    });

    it('Should update odds and notify the user, if during betting the odds have changed', async () => {
        await createUserBalance(
            getTestBalanceTemplate({ userId: TEST_DISCORD_USER.id, userName: TEST_DISCORD_USER.tag, amount: 100 }),
        );
        await createUser(getTestUserTemplate());
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(
            getTestGameTemplate({
                gameStart: DateTime.fromISO(new Date().toISOString()).minus({ minutes: 9 }).toMillis(),
            }),
        );
        await createGameMeta(getTestGameMetaTemplate(game.id));
        await createBet(getTestBetTemplate({ amount: 0 }));
        const interaction = getTestInteraction({ values: '10' });
        const spy = sandbox.spy(interaction, 'update');
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, {
                gameId: 3218543000,
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
                gameStartTime: Date.now() - 544900,
                gameLength: 0,
            });
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, []);
        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
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
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad **10** muumimünti. **NB! Koefitsenti kohandati**. Uus koefitsent: **1.6**`,
            components: [rowButton],
            flags: MessageFlags.Ephemeral,
        });
        const bets = await testDb('bets').where({ odds: 1.6 });
        expect(bets.length).to.eq(1);
    });
});
