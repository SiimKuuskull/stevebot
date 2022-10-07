import { SlashCommandBuilder } from '@discordjs/builders';
import { BetGuess } from '../../../../database/models/bet.model';
import { findUserActiveBet } from '../../../../database/queries/bets.query';

export const myBet = {
    data: new SlashCommandBuilder().setName('my-bet').setDescription('Check your active bets!'),
    execute: async (interaction) => {
        const bet = await findUserActiveBet(interaction.user.id);
        const message = bet
            ? `Sa oled panustanud ${bet.amount} muumimünti Steve ${
                  bet.guess === BetGuess.WIN ? 'võidule' : 'katousele'
              }. Õige ennustuse puhul võidad ${Math.round(bet.amount * bet.odds)}.`
            : 'Sul ei ole ühtegi tulemuseta panust.';
        await interaction.reply({
            content: message,
            ephemeral: true,
        });
    },
};
