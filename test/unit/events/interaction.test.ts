import { expect } from 'chai';
import sinon from 'sinon';
import { interaction as interactionEvent } from '../../../src/services/discord/events/interaction/interaction.ts';

describe('Events - interactionCreate', () => {
    const failingClient = {
        commands: new Map([['place-bet', { execute: () => Promise.reject(new Error('Riot API is down')) }]]),
    };

    function getFailingInteraction(state: { deferred: boolean; replied: boolean }) {
        return {
            ...state,
            commandName: 'place-bet',
            user: { tag: 'Siim' },
            channel: { name: 'steve' },
            isCommand: () => true,
            reply: sinon.fake.resolves(undefined),
            editReply: sinon.fake.resolves(undefined),
            followUp: sinon.fake.resolves(undefined),
        };
    }

    it('Should reply with an error if the command failed before responding', async () => {
        const interaction = getFailingInteraction({ deferred: false, replied: false });

        await interactionEvent.execute(interaction, failingClient);

        expect(interaction.reply.calledOnce).to.eq(true);
        expect(interaction.editReply.called).to.eq(false);
        expect(interaction.followUp.called).to.eq(false);
    });
    it('Should replace the deferred placeholder with an error if the command failed after deferring', async () => {
        const interaction = getFailingInteraction({ deferred: true, replied: false });

        await interactionEvent.execute(interaction, failingClient);

        expect(interaction.editReply.calledOnce).to.eq(true);
        expect(interaction.reply.called).to.eq(false);
        expect(interaction.followUp.called).to.eq(false);
    });
    it('Should follow up with an error if the command failed after replying', async () => {
        const interaction = getFailingInteraction({ deferred: true, replied: true });

        await interactionEvent.execute(interaction, failingClient);

        expect(interaction.followUp.calledOnce).to.eq(true);
        expect(interaction.reply.called).to.eq(false);
        expect(interaction.editReply.called).to.eq(false);
    });
    it('Should not throw if responding with the error fails too', async () => {
        const interaction = getFailingInteraction({ deferred: false, replied: false });
        interaction.reply = sinon.fake.rejects(new Error('Unknown interaction'));

        await interactionEvent.execute(interaction, failingClient);

        expect(interaction.reply.calledOnce).to.eq(true);
    });
});
