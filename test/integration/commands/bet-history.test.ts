import { betHistory } from '../../../src/services/discord/commands/bet-history/bet-history';
import { getTestBetTemplate, getTestInteraction, TEST_DISCORD_USER } from '../../test-data';
import { sandbox, testDb } from '../init';
import { expect } from 'chai';
import { createBet } from '../../../src/database/queries/bets.query';
import { BetResult } from '../../../src/database/models/bet.model';

describe('Discord command - /bet-history', () => {
    const { execute } = betHistory;
    it('Should return a reply if there are no bets found by the user', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        expect(spy.args[0][0]).to.deep.equal({
            content: `${interaction.user.tag} ei ole teinud ühtegi panust.`,
            components: [],
            ephemeral: true,
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
