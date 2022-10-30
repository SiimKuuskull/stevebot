import { expect } from 'chai';
import { BetGuess, BetResult } from '../../../src/database/models/bet.model';
import { createBet } from '../../../src/database/queries/bets.query';
import { leaderboard } from '../../../src/services/discord/commands/leaderboard/leaderboard';
import { enableLogs } from '../../../src/tools/logger';
import { getTestBalanceTemplate, getTestBetTemplate, getTestInteraction } from '../../test-data';
import { sandbox, testDb } from '../init';
import { createUserBalance } from '../../../src/database/queries/balance.query';

describe('Discord command - /leaderboard', () => {
    const { execute } = leaderboard;
    it('Should return a reply if there is no currency nor active players', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const balances = await testDb('balance');
        expect(balances.length).to.eq(0);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Muumiorus pole praegu aktiivseid muumisid, proovi hiljem uuesti!`,
            components: [],
            ephemeral: true,
        });
    });
    it('Should return a reply if there are no finalised bets', async () => {
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        await createBet(getTestBetTemplate({ guess: BetGuess.LOSE, result: BetResult.IN_PROGRESS, odds: 2 }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const bets = await testDb('bets').whereNot({ result: BetResult.IN_PROGRESS });
        await testDb('balance');

        expect(bets.length).to.eq(0);
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Hetkel ei ole lõpetatud panuseid`,
            components: [],
            ephemeral: true,
        });
    });
    it('Should return a reply if there are finalised bets', async () => {
        await createUserBalance(getTestBalanceTemplate({ amount: 10 }));
        await createBet(getTestBetTemplate({ guess: BetGuess.WIN, result: BetResult.WIN, odds: 2 }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        await testDb('balance');
        const bets = await testDb('bets').whereNot({ result: BetResult.IN_PROGRESS });
        expect(bets.length).to.eq(1);
        expect(spy.calledOnce).to.eq(true);
    });
});
