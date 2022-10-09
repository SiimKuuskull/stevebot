import { updateBrokeUserBalance } from '../../../../database/queries/balance.query';
import { wipeUserLoans } from '../../../../database/queries/loans.query';

export async function bankruptcyDeclared(interaction) {
    const newBalance = await updateBrokeUserBalance(interaction.user.id);
    await wipeUserLoans(interaction.user.id);
    await interaction.update({
        content: `Oled välja kuulutanud pankroti! \n
Su uus kontoseis on ${newBalance.amount} muumimünti. See on sinu ${
            newBalance.bankruptcy
        } pankrott. Järgnevalt 5 võidult maksad Suurele Muumile ${newBalance.penalty * 100}% lõivu.`,
        components: [],
    });
}
