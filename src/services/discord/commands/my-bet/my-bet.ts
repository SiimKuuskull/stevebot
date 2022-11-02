import { SlashCommandBuilder } from '@discordjs/builders';
import { BetResult } from '../../../../database/models/bet.model';
import { findUserActiveBet } from '../../../../database/queries/bets.query';

export const myBet = {
    data: new SlashCommandBuilder().setName('my-bet').setDescription('Vaata oma tehtud panust praegusele mängule'),
    execute: async (interaction) => {
        const bet = await findUserActiveBet(interaction.user.id);
        const message = bet
            ? `Sa oled panustanud ${bet.amount} muumimünti Steve ${
                  bet.guess === BetResult.WIN ? 'võidule' : 'kaotusele'
              }. Õige ennustuse puhul võidad ${Math.round(bet.amount * bet.odds)}.`
            : 'Sul ei ole ühtegi tulemuseta panust.';
        await interaction.reply({
            content: message,
            ephemeral: true,
        });
    },
};
