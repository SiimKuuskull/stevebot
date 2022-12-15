import { BetResult } from '../../../src/database/models/bet.model';
import { SteveGameStatus } from '../../../src/database/models/steveGame.model';
import { createBet } from '../../../src/database/queries/bets.query';
import { guessSelected } from '../../../src/services/discord/interactions/betting/guessSelected';
import { getTestBalanceTemplate, getTestBetTemplate, getTestGameTemplate, getTestInteraction } from '../../test-data';
import { sandbox, testDb } from '../init';
import { expect } from 'chai';
import { createSteveGame } from '../../../src/database/queries/steveGames.query';
import { createUserBalance } from '../../../src/database/queries/balance.query';
import { Interaction } from '../../../src/services/interaction.service';
import { TransactionType } from '../../../src/database/models/transactions.model';

describe('Discord interaction - GUESS_SELECTED', () => {
    it('Should send a reply, if there is no IN PROGRESS game and delete the existing bet', async () => {
        await createBet(getTestBetTemplate({ guess: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction();
        const spy = sandbox.spy(interaction, 'reply');

        await guessSelected(interaction);

        const bets = await testDb('bets');
        const games = await testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS });

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':sleeping: | Kahjuks Steve mäng sai läbi. Oota järgmist mängu!',
            components: [],
            ephemeral: true,
        });
        expect(bets.length).to.eq(0);
        expect(games.length).to.eq(0);
    });
    it('Should place a bet with a decision "WIN" and display a message', async () => {
        await createSteveGame(getTestGameTemplate());
        const bet = await createBet(getTestBetTemplate({ guess: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction({ customId: Interaction.BET_WIN });
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const spy = sandbox.spy(interaction, 'update');

        await guessSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Pakkumine: Steve **võidab!** Panus: **10** muumimünti',
            components: [],
            ephemeral: true,
        });
        const [bets, games, transactions] = await Promise.all([
            testDb('bets'),
            testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS }),
            testDb('transactions'),
        ]);
        expect(bets.length).to.eq(1);
        expect(games.length).to.eq(1);
        expect(transactions.length).to.eq(1);
        delete transactions[0].createdAt;
        delete transactions[0].updatedAt;
        expect(transactions[0]).to.deep.equal({
            id: 1,
            amount: -bet.amount,
            balance: 90,
            externalTransactionId: bet.id,
            type: TransactionType.BET_PLACED,
            userId: bet.userId,
        });
    });
    it('Should place a bet with a decision "LOSE" and display a message', async () => {
        await createSteveGame(getTestGameTemplate());
        const bet = await createBet(getTestBetTemplate({ guess: BetResult.IN_PROGRESS }));
        const interaction = getTestInteraction({ customId: Interaction.BET_LOSE });
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const spy = sandbox.spy(interaction, 'update');

        await guessSelected(interaction);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: 'Pakkumine: Steve **kaotab!** Panus: **10** muumimünti',
            components: [],
            ephemeral: true,
        });
        const [bets, games, transactions] = await Promise.all([
            testDb('bets'),
            testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS }),
            testDb('transactions'),
        ]);
        expect(bets.length).to.eq(1);
        expect(games.length).to.eq(1);
        expect(transactions.length).to.eq(1);
        delete transactions[0].createdAt;
        delete transactions[0].updatedAt;
        expect(transactions[0]).to.deep.equal({
            id: 1,
            amount: -bet.amount,
            balance: 90,
            externalTransactionId: bet.id,
            type: TransactionType.BET_PLACED,
            userId: bet.userId,
        });
    });
    it('Should not be able to change your guess, after having chosen one.', async () => {
        await createSteveGame(getTestGameTemplate());
        await createBet(getTestBetTemplate({ guess: BetResult.WIN }));
        const interaction = getTestInteraction({ customId: Interaction.BET_LOSE });
        await createUserBalance(getTestBalanceTemplate({ amount: 100 }));
        const spy = sandbox.spy(interaction, 'reply');

        await guessSelected(interaction);

        const bets = await testDb('bets');
        const games = await testDb('steve_games').where({ game_status: SteveGameStatus.IN_PROGRESS });

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: ':thinking_face: | Olete juba oma panuse teinud. Kasutage */my-bet* , et näha oma tehtud panust.',
            components: [],
            ephemeral: true,
        });
        expect(bets.length).to.eq(1);
        expect(games.length).to.eq(1);
    });
});
