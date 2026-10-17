import { MessageFlags } from 'discord.js';
import { betHistory } from '../../../src/services/discord/commands/bet-history/bet-history.ts';
import { getTestBetTemplate, getTestInteraction, TEST_DISCORD_USER } from '../../test-data.ts';
import { sandbox, testDb } from '../init.ts';
import { expect } from 'chai';
import { createBet, getAllResultedBets, getBetsWinLossCount } from '../../../src/database/queries/bets.query.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';

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
