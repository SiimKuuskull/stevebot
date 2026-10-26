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

    it('Should route autocomplete to the command without executing it', async () => {
        const command = { execute: sinon.fake.resolves(undefined), autocomplete: sinon.fake.resolves(undefined) };
        const interaction = { isAutocomplete: () => true, commandName: 'untrack-player' };

        await interactionEvent.execute(interaction, { commands: new Map([['untrack-player', command]]) });

        expect(command.autocomplete.calledOnceWithExactly(interaction)).to.eq(true);
        expect(command.execute.called).to.eq(false);
    });

    it('Should acknowledge missing or failed autocomplete with an empty list', async () => {
        for (const command of [{}, { autocomplete: sinon.fake.rejects(new Error('Database unavailable')) }]) {
            const interaction = {
                isAutocomplete: () => true,
                commandName: 'untrack-player',
                responded: false,
                respond: sinon.fake.resolves(undefined),
            };

            await interactionEvent.execute(interaction, { commands: new Map([['untrack-player', command]]) });

            expect(interaction.respond.calledOnceWithExactly([])).to.eq(true);
        }
    });

    it('Should avoid responding twice when autocomplete has already replied', async () => {
        const command = { autocomplete: sinon.fake.rejects(new Error('Already responded')) };
        const interaction = {
            isAutocomplete: () => true,
            commandName: 'untrack-player',
            responded: true,
            respond: sinon.fake.resolves(undefined),
        };

        await interactionEvent.execute(interaction, { commands: new Map([['untrack-player', command]]) });

        expect(interaction.respond.called).to.eq(false);
    });

    it('Should dispatch a DM command without requiring a cached channel', async () => {
        const interaction = { ...getFailingInteraction({ deferred: false, replied: false }), channel: null };
        const command = { execute: sinon.fake.resolves(undefined) };

        await interactionEvent.execute(interaction, { commands: new Map([['place-bet', command]]) });

        expect(command.execute.calledOnceWithExactly(interaction)).to.eq(true);
        expect(interaction.reply.called).to.eq(false);
    });
});
