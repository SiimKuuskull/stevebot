import { MessageFlags } from 'discord.js';
import { findUserBalance } from '../../../../database/queries/balance.query.ts';
import { goBankrupt } from '../../../bankruptcy.service.ts';

export async function bankruptcyDeclared(interaction: any) {
    const balance = await findUserBalance(interaction.user.id);
    if (!balance) {
        await interaction.update({
            content: ':flushed: Midagi läks lappesse, ei saanud pankrotti välja kuulutada',
            components: [],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const bankruptBalance = await goBankrupt(balance);
    await interaction.update({
        content: `Oled välja kuulutanud pankroti! \n
        Su uus kontoseis on ${bankruptBalance.amount} muumimünti. See on sinu ${
            bankruptBalance.bankruptcy
        } pankrott. Järgnevalt 5 võidult maksad Suurele Muumile ${bankruptBalance.penalty * 100}% lõivu.`,
        components: [],
        flags: MessageFlags.Ephemeral,
    });
}
