import { MessageFlags } from 'discord.js';
import { betHistory } from '../../../src/services/discord/commands/bet-history/bet-history.ts';
import {
    getTestBetTemplate,
    getTestGameMetaTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
    TEST_DISCORD_USER,
    TEST_TRACKED_PLAYER,
} from '../../test-data.ts';
import { sandbox, testDb } from '../init.ts';
import { expect } from 'chai';
import { createBet, getAllResultedBets, getBetsWinLossCount } from '../../../src/database/queries/bets.query.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { type GameMeta } from '../../../src/database/models/gameMeta.model.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { createGameMeta } from '../../../src/database/queries/gameMeta.query.ts';

describe('Discord command - /bet-history', () => {
    const { execute } = betHistory;
    it('Should return a reply if there are no bets found by the user', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.args[0][0]).to.deep.equal({
            content: `${interaction.user.tag} ei ole teinud ühtegi panust.`,
            components: [],
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should list pending bets if the user has no resulted bets yet', async () => {
        await createBet(getTestBetTemplate({ guess: BetResult.WIN, result: BetResult.IN_PROGRESS, amount: 50 }));
        await createBet(getTestBetTemplate({ guess: BetResult.LOSE, result: BetResult.IN_PROGRESS, amount: 20 }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.args[0][0]).to.deep.equal({
            content: `:face_with_peeking_eye: **${interaction.user.tag}** muumimündid on järgmistes mängudes.:\n1. **VÕIDAB** — 50 muumimünti\n2. **KAOTAB** — 20 muumimünti`,
            components: [],
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should show the tracked player and match type of pending bets', async () => {
        await addPlayer(getTestTrackedPlayerTemplate());
        const game = await createSteveGame(getTestGameTemplate());
        await createGameMeta(
            getTestGameMetaTemplate(game.id, {
                meta: { ...getTestGameMetaTemplate(game.id).meta, gameQueueConfigId: 420 } as GameMeta['meta'],
            }),
        );
        await createBet(
            getTestBetTemplate({
                gameId: game.gameId,
                guess: BetResult.WIN,
                result: BetResult.IN_PROGRESS,
                amount: 50,
            }),
        );
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.args[0][0].content).to.include(
            `1. **${TEST_TRACKED_PLAYER.gameName}** (ranked solo): **VÕIDAB** — 50 muumimünti`,
        );
    });
    it('Should not treat a bet without a guess as pending', async () => {
        await createBet(getTestBetTemplate({ guess: BetResult.IN_PROGRESS, result: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.args[0][0].content).to.eq(`${interaction.user.tag} ei ole teinud ühtegi panust.`);
    });
    it('Should get all user bets and profits and send a reply', async () => {
        await createBet(getTestBetTemplate({ guess: BetResult.LOSE, result: BetResult.LOSE }));

        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const bets = await testDb('bets').select().where('userId', TEST_DISCORD_USER.id);
        expect(bets.length).to.eq(1);
        expect(spy.calledOnce).to.eq(true);
    });
    it('Should display voided bets without counting them as losses or lost profit', async () => {
        await createBet(getTestBetTemplate({ guess: BetResult.WIN, result: BetResult.VOID, amount: 50 }));
        await createBet(getTestBetTemplate({ guess: BetResult.WIN, result: BetResult.WIN, amount: 10, odds: 2 }));
        await createBet(getTestBetTemplate({ guess: BetResult.WIN, result: BetResult.LOSE, amount: 5 }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const fields = spy.firstCall.args[0].embeds[0].toJSON().fields;
        expect(fields[2].value).to.include('**TÜHISTATUD**');
        expect(fields[3].value).to.include('kasum on **5**');
        const counts = await getBetsWinLossCount();
        expect(counts.betWins).to.deep.equal([{ user_id: TEST_DISCORD_USER.id, count: '1' }]);
        expect(counts.betLosses).to.deep.equal([{ user_id: TEST_DISCORD_USER.id, count: '1' }]);
        const resultedBets = await getAllResultedBets();
        expect(resultedBets.map((bet) => bet.result)).to.have.members([BetResult.WIN, BetResult.LOSE]);
    });
});
