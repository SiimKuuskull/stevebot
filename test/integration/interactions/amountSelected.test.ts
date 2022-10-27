import { sandbox, testDb } from '../init';
import { amountSelected } from '../../../src/services/discord/interactions/betting/amountSelected';
import {
    getTestBetTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
} from '../../test-data';
import { expect } from 'chai';
import { addPlayer } from '../../../src/database/queries/player.query';
import nock from 'nock';
import { RIOT_API_EUNE_URL, RIOT_API_EU_URL } from '../../../src/services/riot-games/requests';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { createBet } from '../../../src/database/queries/bets.query';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Interaction } from '../../../src/services/interaction.service';

describe('Discord interaction - AMOUNT_SELECTED', () => {
    it('Should not allow betting if no active game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        nock(RIOT_API_EUNE_URL)
            .get(`/lol/spectator/v4/active-games/by-summoner/${player.id}`)
            .reply(200, { status: { status_code: 404 } });

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Hetkel ei ole aktiivset mängu! Steve XP waste',
            components: [],
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(0);
    });
    it('Should not allow multiple bets on 1 game per user', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const bet = await createBet(getTestBetTemplate({ gameId: game.gameId }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
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
        nock(RIOT_API_EU_URL).get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`).reply(200, []);

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu!',
            components: [],
            ephemeral: true,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(1);
        expect(bets[0].id).to.eq(bet.id);
    });
    it('Should not allow to bet on a finished game', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
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
        nock(RIOT_API_EU_URL)
            .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
            .reply(200, [`EUN1_${game.gameId}`]);

        await amountSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Hetkel ei ole aktiivset mängu! Steve XP waste',
            components: [],
            ephemeral: true,
        });
        const bets = await testDb('bets');
        expect(bets.length).to.eq(0);
    });
    it('Should trigger custom bet modal', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction({ values: 'custom' });
        const showModalSpy = sandbox.spy(interaction, 'showModal');
        const editReplySpy = sandbox.spy(interaction, 'editReply');
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
        expect(bets.length).to.eq(0);
    });
    it('Should place a bet', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        const interaction = getTestInteraction({ values: '10' });
        const spy = sandbox.spy(interaction, 'update');
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
        );
        expect(spy.args[0][0]).to.deep.equal({
            content: `Panustad 10 muumimünti`,
            components: [rowButton],
            ephemeral: true,
        });

        const bets = await testDb('bets');
        expect(bets.length).to.eq(1);
    });
});
