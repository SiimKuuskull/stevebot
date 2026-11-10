import { expect } from 'chai';
import nock from 'nock';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { EXPIRED_BET_MESSAGE, startBettingDraft } from '../../../src/services/bet.service.ts';
import { displayBettingButtons } from '../../../src/services/discord/components/betDecision.ts';
import { amountSelected } from '../../../src/services/discord/interactions/betting/amountSelected.ts';
import { interaction as interactionEvent } from '../../../src/services/discord/events/interaction/interaction.ts';
import { Interaction } from '../../../src/services/interaction.service.ts';
import { RIOT_PLATFORM_URL } from '../../../src/services/riot-games/requests.ts';
import { getTestInteraction } from '../../test-data.ts';
import { bettingFixture, mockLiveGame } from '../betting-fixtures.ts';
import { sandbox, testDb } from '../init.ts';

describe('Discord interaction - game-bound amount selection', () => {
    for (const ownerTeam of [100, 200]) {
        for (const team of [undefined, 100, 200]) {
            it(`Shows correct choices for bettor team ${team ?? 'spectator'} and owner team ${ownerTeam}`, async () => {
                const fixture = await bettingFixture({ team });
                await testDb('game_meta')
                    .where({ steveGameId: fixture.game.id })
                    .update({
                        meta: {
                            ...fixture.meta,
                            participants: fixture.meta.participants.map((participant) => ({
                                ...participant,
                                teamId: participant.puuid === fixture.player.puuid ? ownerTeam : participant.teamId,
                            })),
                        },
                    });
                const interaction = getTestInteraction();
                const reply = sandbox.spy(interaction, 'editReply');
                await displayBettingButtons(interaction, fixture.bet, fixture.context);
                const ids = reply.firstCall.args[0].components[0]
                    .toJSON()
                    .components.map((button: any) => button.custom_id);
                expect(ids.includes(fixture.customId(Interaction.BET_WIN, 2))).to.eq(!team || team === ownerTeam);
                expect(ids.includes(fixture.customId(Interaction.BET_LOSE, 2))).to.eq(!team || team !== ownerTeam);
                expect(ids).to.include(fixture.customId(Interaction.BET_CANCEL));
            });
        }
    }

    it('Routes an encoded amount control and changes only its game draft', async () => {
        const fixture = await bettingFixture();
        const other = await bettingFixture({ suffix: 'second' });
        mockLiveGame(fixture);
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED),
            values: ['10'],
            isCommand: () => false,
            channel: { name: 'test' },
        });
        const deferred = sandbox.spy(interaction, 'deferUpdate');
        const reply = sandbox.spy(interaction, 'editReply');
        await interactionEvent.execute(interaction, {});
        expect(deferred.calledOnce).to.eq(true);
        expect(reply.firstCall.args[0].components[0].toJSON().components[0].custom_id).to.eq(
            fixture.customId(Interaction.BET_WIN, 2),
        );
        expect((await testDb('bets').where({ id: fixture.bet.id }).first())?.amount).to.eq(10);
        expect((await testDb('bets').where({ id: other.bet.id }).first())?.amount).to.eq(0);
        expect((await testDb('balance').first())?.amount).to.eq(100);
        expect(await testDb('transactions')).to.have.length(0);
    });

    it('Opens a custom modal bound to this draft without deferring or calling Riot', async () => {
        const fixture = await bettingFixture();
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED),
            values: ['custom'],
        });
        const modal = sandbox.spy(interaction, 'showModal');
        const defer = sandbox.spy(interaction, 'deferUpdate');
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelected(interaction);
        expect(modal.calledOnce).to.eq(true);
        const data = modal.firstCall.args[0].toJSON();
        expect(data.custom_id).to.eq(fixture.customId(Interaction.AMOUNT_SELECTED_CUSTOM));
        expect(data.components[0].components[0].max_length).to.eq(6);
        expect(defer.called || reply.called).to.eq(false);
    });

    it('Updates the displayed odds when selecting an amount after an odds boundary', async () => {
        const fixture = await bettingFixture({ startTime: Date.now() - 10 * 60000 });
        mockLiveGame(fixture);
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED),
            values: ['10'],
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelected(interaction);
        expect(reply.firstCall.args[0].content).to.include('Koefitsent muutus');
        expect(reply.firstCall.args[0].components[0].toJSON().components[0].custom_id).to.eq(
            fixture.customId(Interaction.BET_WIN, 1.6),
        );
    });

    for (const state of [
        'completed',
        'untracked',
        'confirmed',
        'refunded',
        'replaced',
        'foreign-user',
        'wrong-game',
        'legacy',
    ] as const) {
        it(`Rejects a ${state} amount control without changing any bet`, async () => {
            const fixture = await bettingFixture();
            let customId = fixture.customId(Interaction.AMOUNT_SELECTED);
            let user = { id: fixture.userId };
            if (state === 'completed') {
                await testDb('steve_games')
                    .where({ id: fixture.game.id })
                    .update({ gameStatus: SteveGameStatus.COMPLETED });
            }
            if (state === 'untracked') {
                await testDb('player').where({ id: fixture.player.id }).update({ isTracked: false });
            }
            if (state === 'confirmed') {
                await testDb('bets').where({ id: fixture.bet.id }).update({ guess: BetResult.WIN });
            }
            if (state === 'refunded') {
                await testDb('bets').where({ id: fixture.bet.id }).update({ result: BetResult.VOID });
            }
            if (state === 'replaced') {
                await startBettingDraft(fixture.userId, fixture.context);
            }
            if (state === 'foreign-user') {
                user = { id: 'another-user' };
            }
            if (state === 'wrong-game') {
                const other = await bettingFixture({ suffix: 'other' });
                customId = `AMOUNT_SELECTED:${other.game.id}:${fixture.bet.id}`;
            }
            if (state === 'legacy') {
                customId = Interaction.AMOUNT_SELECTED;
            }
            const before = await testDb('bets').orderBy('id');
            const interaction = getTestInteraction({ customId, values: ['10'], user });
            const reply = sandbox.spy(interaction, 'editReply');
            await amountSelected(interaction);
            expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
            expect(await testDb('bets').orderBy('id')).to.deep.eq(before);
        });
    }

    it('Rejects a finished match even while the spectator endpoint still reports it', async () => {
        const fixture = await bettingFixture();
        mockLiveGame(fixture, { finished: true });
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED),
            values: ['10'],
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelected(interaction);
        expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
        expect((await testDb('bets').first())?.amount).to.eq(0);
    });

    it('Rejects an old game control when Riot now reports a different match', async () => {
        const fixture = await bettingFixture();
        nock(RIOT_PLATFORM_URL.EUN1)
            .get(`/lol/spectator/v5/active-games/by-summoner/${fixture.player.puuid}`)
            .reply(200, { gameId: Number(fixture.game.gameId) + 1, platformId: 'EUN1', gameStartTime: Date.now() });
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED),
            values: ['10'],
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelected(interaction);
        expect(reply.firstCall.args[0].content).to.eq(EXPIRED_BET_MESSAGE);
    });

    it('Leaves the amount unset when the game owner is missing from participant metadata', async () => {
        const fixture = await bettingFixture();
        await testDb('game_meta')
            .where({ steveGameId: fixture.game.id })
            .update({ meta: { ...fixture.meta, participants: [] } });
        mockLiveGame(fixture);
        const interaction = getTestInteraction({
            customId: fixture.customId(Interaction.AMOUNT_SELECTED),
            values: ['10'],
        });
        const reply = sandbox.spy(interaction, 'editReply');
        await amountSelected(interaction);
        expect(reply.firstCall.args[0].components).to.deep.eq([]);
        expect((await testDb('bets').first())?.amount).to.eq(0);
    });
});
