import { MessageFlags } from 'discord.js';
import { betHistory } from '../../../src/services/discord/commands/bet-history/bet-history.ts';
import { getTestBetTemplate, getTestInteraction, TEST_DISCORD_USER } from '../../test-data.ts';
import { sandbox, testDb } from '../init.ts';
import { expect } from 'chai';
import { createBet } from '../../../src/database/queries/bets.query.ts';
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
});
