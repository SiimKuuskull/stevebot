import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { MessageFlags } from 'discord.js';
import { sandbox, testDb } from '../init.ts';
import { myBet } from '../../../src/services/discord/commands/my-bet/my-bet.ts';
import {
    getTestBetTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
} from '../../test-data.ts';
import { expect } from 'chai';
import { createBet } from '../../../src/database/queries/bets.query.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { bettingFixture } from '../betting-fixtures.ts';
import { untrackPlayer } from '../../../src/services/player.service.ts';

describe('Discord command - /my-bet', () => {
    const { execute } = myBet;
    it('Should say there is no bet', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Sul ei ole ühtegi tulemuseta panust.',
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should say there is no bet if the bet is resulted already', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStatus: SteveGameStatus.COMPLETED }),
        );
        await createBet(getTestBetTemplate({ steveGameId: game.id, guess: BetResult.LOSE, result: BetResult.LOSE }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Sul ei ole ühtegi tulemuseta panust.',
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should say there is an in progress bet', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStatus: SteveGameStatus.COMPLETED }),
        );
        const bet = await createBet(
            getTestBetTemplate({ steveGameId: game.id, guess: BetResult.LOSE, result: BetResult.IN_PROGRESS }),
        );
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content:
                `Sinu aktiivsed panused (1):\n\n**[EUNE] ${player.gameName}#${player.tagLine}** · EUN1_${game.gameId}\n` +
                `Panus: **${bet.amount}** muumimünti · Ennustus: **kaotus** · Koefitsent: **${bet.odds}**\n` +
                `Võimalik väljamakse enne lõivu: **${Math.round(bet.amount * bet.odds)}**.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    });

    it('Should show each player and match region even for matching numeric game IDs', async () => {
        const first = await bettingFixture({ suffix: 'first', amount: 20 });
        const second = await bettingFixture({ suffix: 'second', amount: 50 });
        const third = await bettingFixture({ suffix: 'third', platformId: 'EUW1', amount: 10 });
        await testDb('bets').where({ id: first.bet.id }).update({ guess: BetResult.WIN, odds: 1.6 });
        await testDb('bets').where({ id: second.bet.id }).update({ guess: BetResult.LOSE });
        await testDb('bets').where({ id: third.bet.id }).update({ guess: BetResult.WIN });
        await untrackPlayer(first.player.id);
        await testDb('player').where({ id: first.player.id }).update({ platformId: 'EUW1' });
        const interaction = getTestInteraction({ reply: sandbox.stub().resolves() });

        await execute(interaction);

        const { content } = interaction.reply.firstCall.args[0];
        expect(content).to.include('Sinu aktiivsed panused (3)');
        expect(content).to.include(`[EUNE] ${first.player.gameName}#${first.player.tagLine}`);
        expect(content).to.include(`[EUNE] ${second.player.gameName}#${second.player.tagLine}`);
        expect(content).to.include(`[EUW] ${third.player.gameName}#${third.player.tagLine}`);
        expect(content).to.include(`EUN1_${first.game.gameId}`).and.include(`EUW1_${third.game.gameId}`);
        expect(content).to.include('Panus: **20**').and.include('Koefitsent: **1.6**').and.include('**32**');
        expect(content).to.include('**võit**').and.include('**kaotus**');
        expect(content.indexOf(third.player.gameName)).to.be.lessThan(content.indexOf(first.player.gameName));
    });

    it('Should exclude drafts settled bets refunds and other users', async () => {
        const context = await bettingFixture();
        for (const [guess, result, userId] of [
            [BetResult.IN_PROGRESS, BetResult.IN_PROGRESS, context.userId],
            [BetResult.WIN, BetResult.WIN, context.userId],
            [BetResult.LOSE, BetResult.LOSE, context.userId],
            [BetResult.WIN, BetResult.VOID, context.userId],
            [BetResult.WIN, BetResult.IN_PROGRESS, 'someone-else'],
        ]) {
            await createBet(
                getTestBetTemplate({
                    steveGameId: context.game.id,
                    amount: 10,
                    guess: guess as BetResult,
                    result: result as BetResult,
                    userId,
                }),
            );
        }
        const interaction = getTestInteraction({ reply: sandbox.stub().resolves() });

        await execute(interaction);

        expect(interaction.reply.firstCall.args[0].content).to.eq('Sul ei ole ühtegi tulemuseta panust.');
    });

    it('Should keep legacy bets visible when their game has no player', async () => {
        const context = await bettingFixture({ amount: 20 });
        await testDb('steve_games').where({ id: context.game.id }).update({ playerId: null });
        await testDb('bets').where({ id: context.bet.id }).update({ guess: BetResult.WIN });
        const interaction = getTestInteraction({ reply: sandbox.stub().resolves() });

        await execute(interaction);

        expect(interaction.reply.firstCall.args[0].content)
            .to.include('Tundmatu mängija')
            .and.include(`EUN1_${context.game.gameId}`);
    });

    it('Should split long lists into private messages without dropping bets', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ gameName: '*Long* player @everyone' }));
        for (let index = 0; index < 15; index++) {
            const game = await createSteveGame(
                getTestGameTemplate({ playerId: player.id, gameId: String(1000 + index) }),
            );
            await createBet(
                getTestBetTemplate({ steveGameId: game.id, guess: BetResult.WIN, result: BetResult.IN_PROGRESS }),
            );
        }
        const interaction = getTestInteraction({
            reply: sandbox.stub().resolves(),
            followUp: sandbox.stub().resolves(),
        });

        await execute(interaction);

        expect(interaction.followUp.called).to.eq(true);
        const messages = [...interaction.reply.args, ...interaction.followUp.args].map(([message]) => message);
        for (const message of messages) {
            expect(message.content.length).to.be.at.most(2000);
            expect(message.content).to.include('\\*Long\\*');
            expect(message.flags).to.eq(MessageFlags.Ephemeral);
            expect(message.allowedMentions).to.deep.eq({ parse: [] });
        }
        const content = messages.map((message) => message.content).join('\n');
        expect(content.match(/EUN1_\d+/g)).to.have.length(15);
        for (let index = 0; index < 15; index++) {
            expect(content).to.include(`EUN1_${1000 + index}`);
        }
    });
});
