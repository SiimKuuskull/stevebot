import { sandbox, testDb } from '../init';
import { amountSelected } from '../../../src/services/discord/interactions/betting/amountSelected';
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
import { expect } from 'chai';
import { addPlayer } from '../../../src/database/queries/player.query';
import nock from 'nock';
import { RIOT_API_EUNE_URL, RIOT_API_EU_URL } from '../../../src/services/riot-games/requests';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { createBet } from '../../../src/database/queries/bets.query';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Interaction } from '../../../src/services/interaction.service';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { DateTime } from 'luxon';
import { BetResult } from '../../../src/database/models/bet.model';
import { createGameMeta } from '../../../src/database/queries/gameMeta.query';
import { createUser } from '../../../src/database/queries/users.query';

describe('Discord interaction - AMOUNT_SELECTED', () => {
    it('Should not allow betting if no active game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
            .reply(200, { status: { status_code: 404 } });

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            ephemeral: true,
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
        nock(RIOT_API_EUNE_URL)
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
            ephemeral: true,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(1);
        expect(bets[0].id).to.eq(bet.id);
    });
    it('Should not allow to bet on a finished game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate({ gameResult: true }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
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
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, [`EUN1_${game.gameId}`]);
        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':rolling_eyes: | Hetkel ei ole aktiivset mängu! Steve XP waste..',
            components: [],
            ephemeral: true,
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
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, []);

        await amountSelected(interaction);

        expect(showModalSpy.calledOnce).to.eq(true);
        expect(editReplySpy.calledOnce).to.eq(true);
        expect(editReplySpy.args[0][0]).to.deep.equal({
            content: `Valisid muu koguse panustamise! Palun sisesta enda soovitud panus!`,
            components: [],
            ephemeral: true,
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
            ephemeral: true,
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
        nock(RIOT_API_EUNE_URL)
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
            ephemeral: true,
        });
        const bets = await testDb('bets').where({ odds: 1.6 });
        expect(bets.length).to.eq(1);
    });
});
