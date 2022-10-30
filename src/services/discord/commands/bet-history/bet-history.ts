import { SlashCommandBuilder } from '@discordjs/builders';
import { db } from '../../../../database/db';
import { Bet, BetGuess, BetResult } from '../../../../database/models/bet.model';
import { log } from '../../../../tools/logger';

export const betHistory = {
    data: new SlashCommandBuilder().setName('bet-history').setDescription('Check bet history'),
    execute: async (interaction) => {
        const bets = await getUserBets(interaction.user.id);
        if (!bets.length) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole teinud ühtegi panust.`,
                components: [],
                ephemeral: true,
            });
        }
        const profit = await getUserProfit(interaction.user.tag, bets);
        let index = 0;
        await interaction.reply({
            content: `${interaction.user.tag}  panused:\n
            Kogus:          Koefitsent:          Pakkumine:              Tulemus:
        ${bets
            .map((bet) => {
                const result = `
${(index += 1)}.                    ${bet.amount}              ${bet.odds}                         ${
                    bet.guess
                }                         ${bet.result} \n`;
                return `${result}`;
            })
            .toString()
            .replaceAll(',', '')}
${interaction.user.tag} kasum on ${profit} muumimünti      `,
            ephemeral: true,
        });
    },
};

async function getUserBets(userId) {
    const bets = await db<Bet>('bets').select().where('userId', userId);
    return bets;
}
export async function getUserProfit(user, bets) {
    let profit = 0;
    bets.forEach((bet: Bet) => {
        if (
            (bet.guess === BetGuess.WIN && bet.result === BetResult.WIN) ||
            (bet.guess === BetGuess.LOSE && bet.result === BetResult.LOSE)
        ) {
            profit += bet.amount * bet.odds;
        }
        if (
            (bet.guess === BetGuess.WIN && bet.result === BetResult.LOSE) ||
            (bet.guess === BetGuess.LOSE && bet.result === BetResult.WIN)
        ) {
            profit -= bet.amount * bet.odds;
        }
        return profit;
    });
    log(`User: ${user} profits ${profit} muumicoins`);
    return profit;
}
