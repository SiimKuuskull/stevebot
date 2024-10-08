import { expect } from 'chai';
import { LoanPayBack } from '../../../src/database/models/loan.model';
import { createLoan } from '../../../src/database/queries/loans.query';
import { bankruptcyDeclared } from '../../../src/services/discord/interactions/loans/bankruptcyDeclared';
import { getTestInteraction, getUnresolvedTestLoanTemplate, TEST_DISCORD_USER } from '../../test-data';
import { sandbox, testDb } from '../init';
import { useBettingAccount } from '../../../src/services/registration.service';

describe('Discord interaction - BANKRUPTCY_DECLARED', () => {
    it('Should wipe user loans, update their balance and inform them of bankruptcy', async () => {
        const interaction = getTestInteraction();
        await useBettingAccount(interaction.user);
        await createLoan(getUnresolvedTestLoanTemplate({ payback: LoanPayBack.UNRESOLVED }));
        const spy = sandbox.spy(interaction, 'update');

        await bankruptcyDeclared(interaction);

        const balances = await testDb('balance');
        const loans = await testDb('loans').where({ payback: LoanPayBack.WIPED });
        const [newBalance] = await testDb('balance').where('userId', TEST_DISCORD_USER.id);

        expect(spy.calledOnce).to.eq(true);
        expect(spy.args[0][0]).to.deep.equal({
            content: `Oled välja kuulutanud pankroti! \n
        Su uus kontoseis on ${newBalance.amount} muumimünti. See on sinu ${
            newBalance.bankruptcy
        } pankrott. Järgnevalt 5 võidult maksad Suurele Muumile ${newBalance.penalty * 100}% lõivu.`,
            components: [],
            ephemeral: true,
        });
        expect(loans.length).to.eq(1);
        expect(balances.length).to.eq(1);
    });
});
