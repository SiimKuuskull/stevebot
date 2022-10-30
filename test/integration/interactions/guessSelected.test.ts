import { BetGuess } from '../../../src/database/models/bet.model';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model';
import { createBet, findUserBetDecision } from '../../../src/database/queries/bets.query';
import { guessSelected } from '../../../src/services/discord/interactions/betting/guessSelected';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestInteraction,
    TEST_DISCORD_USER,
} from '../../test-data';
import { sandbox, testDb } from '../init';
import { expect } from 'chai';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { Interaction } from '../../../src/services/interaction.service';

describe('Discord interaction - GUESS_SELECTED', () => {
    it('Should send a reply, if there is no IN PROGRESS game and delete the existing bet', async () => {
        await createBet(getTestBetTemplate({ guess: BetGuess.IN_PROGRESS }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await guessSelected(interaction);

        const bets = await testDb('bets');
        const games = await testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS });
        
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Kahjuks Steve mäng sai läbi. Oota järgmist mängu!',
            components: [],
            ephemeral: true,
        });
        expect(bets.length).to.eq(0);
        expect(games.length).to.eq(0);
    });
    it('Should place a bet with a decision "WIN" and display a message', async () => {
        await createSteveGame(getTestGameTemplate());
        await createBet(getTestBetTemplate({ guess: BetGuess.WIN }));
        const interaction = getTestInteraction({ customId: Interaction.BET_WIN });
        const betAmount = (await findUserBetDecision(TEST_DISCORD_USER.tag))?.amount;
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const spy = sandbox.spy(interaction, 'update');

        await guessSelected(interaction);

        const bets = await testDb('bets');
        const games = await testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS });
        
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Steve võidab! Sinu panus: ' + betAmount,
            components: [],
            ephemeral: true,
        });
        expect(bets.length).to.eq(1);
        expect(games.length).to.eq(1);
    });
    it('Should place a bet with a decision "LOSE" and display a message', async () => {
        await createSteveGame(getTestGameTemplate());
        await createBet(getTestBetTemplate({ guess: BetGuess.LOSE }));
        const interaction = getTestInteraction({ customId: Interaction.BET_LOSE });
        const betAmount = (await findUserBetDecision(TEST_DISCORD_USER.tag))?.amount;
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const spy = sandbox.spy(interaction, 'update');

        await guessSelected(interaction);

        const bets = await testDb('bets');
        const games = await testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS });
        
        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Steve kaotab! Sinu panus: ' + betAmount,
            components: [],
            ephemeral: true,
        });
        expect(bets.length).to.eq(1);
        expect(games.length).to.eq(1);
    });
});
