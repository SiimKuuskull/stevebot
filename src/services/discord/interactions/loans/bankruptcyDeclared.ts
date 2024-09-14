import { findUserBalance } from '../../../../database/queries/balance.query';
import { goBankrupt } from '../../../bankruptcy.service';

export async function bankruptcyDeclared(interaction) {
    const balance = await findUserBalance(interaction.user.id);
    const bankruptBalance = await goBankrupt(balance);
    await interaction.update({
        content: `Oled välja kuulutanud pankroti! \n
        Su uus kontoseis on ${bankruptBalance.amount} muumimünti. See on sinu ${
            bankruptBalance.bankruptcy
        } pankrott. Järgnevalt 5 võidult maksad Suurele Muumile ${bankruptBalance.penalty * 100}% lõivu.`,
        components: [],
        ephemeral: true,
    });
}
