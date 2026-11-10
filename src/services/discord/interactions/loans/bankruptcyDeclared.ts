import { InteractionError } from '../../../../tools/errors.ts';
import { BANKRUPTCY_EXPIRED_MESSAGE, goBankrupt } from '../../../bankruptcy.service.ts';
import { Interaction } from '../../../interaction.service.ts';

export async function bankruptcyDeclared(interaction: any) {
    await interaction.deferUpdate();
    try {
        const match =
            typeof interaction.customId === 'string'
                ? new RegExp(`^${Interaction.BANKRUPTCY_DECLARED}:([0-8])$`).exec(interaction.customId)
                : null;
        if (!match) {
            throw new InteractionError(BANKRUPTCY_EXPIRED_MESSAGE);
        }
        const bankruptBalance = await goBankrupt(interaction.user.id, Number(match[1]));
        await interaction.editReply({
            content: `Oled välja kuulutanud pankroti! \n
        Su uus kontoseis on ${bankruptBalance.amount} muumimünti. See on sinu ${
            bankruptBalance.bankruptcy
        } pankrott. Sinu praegune lõiv on ${bankruptBalance.penalty * 100}%. Lõiv väheneb iga lahendatud panusega.`,
            components: [],
        });
    } catch (error) {
        if (!(error instanceof InteractionError)) {
            throw error;
        }
        await interaction.editReply({ content: error.message, components: [] });
    }
}
