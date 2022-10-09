import { sandbox } from '../init';
import { myBet } from '../../../src/services/discord/commands/my-bet/my-bet';
import { getTestBetTemplate, getTestInteraction } from '../../test-data';
import { expect } from 'chai';
import { createBet } from '../../../src/database/queries/bets.query';
import { BetGuess, BetResult } from '../../../src/database/models/bet.model';

describe('Discord command - /my-bet', () => {
    const { execute } = myBet;
    it('Should say there is no bet', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({ content: 'Sul ei ole ühtegi tulemuseta panust.', ephemeral: true });
    });
    it('Should say there is no bet if the bet is resulted already', async () => {
        await createBet(getTestBetTemplate({ guess: BetGuess.LOSE, result: BetResult.LOSE }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({ content: 'Sul ei ole ühtegi tulemuseta panust.', ephemeral: true });
    });
    it('Should say there is an in progress bet', async () => {
        const bet = await createBet(getTestBetTemplate({ guess: BetGuess.LOSE, result: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Sa oled panustanud ${
                bet.amount
            } muumimünti Steve katousele. Õige ennustuse puhul võidad ${Math.round(bet.amount * bet.odds)}.`,
            ephemeral: true,
        });
    });
});
