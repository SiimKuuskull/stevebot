import { bankruptcyDenied } from '../../../src/services/discord/interactions/loans/bankruptcyDenied';
import { expect } from 'chai';
import { getTestInteraction } from '../../test-data';
import { sandbox } from '../init';
describe('Discord interaction - BANKRUPTCY_DENIED', () => {
    it('Should send a reply when bankruptcy is denied', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await bankruptcyDenied(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Otsustasid mitte pankroti avaldust sisse anda. Su kontoseis jääb samaks.`,
            components: [],
            ephemeral: true,
        });
    });
});
