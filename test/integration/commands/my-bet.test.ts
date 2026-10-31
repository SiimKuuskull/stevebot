import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { MessageFlags } from 'discord.js';
import { sandbox } from '../init.ts';
import { myBet } from '../../../src/services/discord/commands/my-bet/my-bet.ts';
import {
    getTestBetTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
} from '../../test-data.ts';
import { expect } from 'chai';
import { createBet } from '../../../src/database/queries/bets.query.ts';
import { BetResult } from '../../../src/database/models/bet.model.ts';

describe('Discord command - /my-bet', () => {
    const { execute } = myBet;
    it('Should say there is no bet', async () => {
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Sul ei ole ühtegi tulemuseta panust.',
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should say there is no bet if the bet is resulted already', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStatus: SteveGameStatus.COMPLETED }),
        );
        await createBet(getTestBetTemplate({ steveGameId: game.id, guess: BetResult.LOSE, result: BetResult.LOSE }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Sul ei ole ühtegi tulemuseta panust.',
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should say there is an in progress bet', async () => {
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStatus: SteveGameStatus.COMPLETED }),
        );
        const bet = await createBet(
            getTestBetTemplate({ steveGameId: game.id, guess: BetResult.LOSE, result: BetResult.IN_PROGRESS }),
        );
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');
        await execute(interaction);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Sa oled panustanud **${
                bet.amount
            }** muumimünti Steve kaotusele. Õige ennustuse puhul võidad **${Math.round(bet.amount * bet.odds)}**.`,
            flags: MessageFlags.Ephemeral,
        });
    });
});
