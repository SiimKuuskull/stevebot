import { SlashCommandBuilder } from '@discordjs/builders';
import { findUserActiveBet } from '../../../../database/queries/placeBet.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';

export const myBet = {
    data: new SlashCommandBuilder().setName('my-bet').setDescription('Check your active bets!'),
    execute: async (interaction) => {
        const activeGame = await findInprogressGame();
        if (!activeGame) {
            await interaction.reply({
                content: `There are currently no active games to have bets on ${interaction.user.tag}.`,
                ephemeral: true,
            });
        }
        const bet = await findUserActiveBet(interaction.user.id);
        if (bet) {
            await interaction.reply({
                content: `Your active bets: game:${bet.gameId} amount: ${bet.amount} muumicoins, guess: ${bet.guess} with ${bet.odds} odds. `,
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: `There are currently no active bets for ${interaction.user.tag}.`,
                ephemeral: true,
            });
        }
    },
};
