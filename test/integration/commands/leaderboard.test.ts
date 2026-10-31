import { SteveGameStatus } from '../../../src/database/models/steveGame.model.ts';
import { createSteveGame } from '../../../src/database/queries/steveGames.query.ts';
import { addPlayer } from '../../../src/database/queries/player.query.ts';
import { MessageFlags } from 'discord.js';
import { expect } from 'chai';
import { BetResult } from '../../../src/database/models/bet.model.ts';
import { createBet } from '../../../src/database/queries/bets.query.ts';
import { leaderboard } from '../../../src/services/discord/commands/leaderboard/leaderboard.ts';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestInteraction,
    getTestTrackedPlayerTemplate,
} from '../../test-data.ts';
import { sandbox, testDb } from '../init.ts';
import { createUserBalance } from '../../../src/database/queries/balance.query.ts';

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
            flags: MessageFlags.Ephemeral,
        });
    });
    it('Should return a reply if there are no finalised bets', async () => {
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStatus: SteveGameStatus.COMPLETED }),
        );
        await createBet(
            getTestBetTemplate({ steveGameId: game.id, guess: BetResult.LOSE, result: BetResult.IN_PROGRESS, odds: 2 }),
        );
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        const bets = await testDb('bets').whereNot({ result: BetResult.IN_PROGRESS });
        await testDb('balance');

        expect(spy.args[0][0]).to.deep.equal({
            content: `Hetkel ei ole lõpetatud panuseid`,
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        expect(bets.length).to.eq(0);
        expect(spy.calledOnce).to.eq(true);
    });
    it('Should return a reply if there are finalised bets', async () => {
        await createUserBalance(getTestBalanceTemplate({ amount: 10 }));
        const player = await addPlayer(getTestTrackedPlayerTemplate({ isTracked: false }));
        const game = await createSteveGame(
            getTestGameTemplate({ playerId: player.id, gameStatus: SteveGameStatus.COMPLETED }),
        );
        await createBet(
            getTestBetTemplate({ steveGameId: game.id, guess: BetResult.WIN, result: BetResult.WIN, odds: 2 }),
        );
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await execute(interaction);

        await testDb('balance');
        const bets = await testDb('bets').whereNot({ result: BetResult.IN_PROGRESS });
        expect(bets.length).to.eq(1);
        expect(spy.calledOnce).to.eq(true);
    });
});
