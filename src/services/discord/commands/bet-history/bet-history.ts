import { SlashCommandBuilder } from '@discordjs/builders';
import { db } from '../../../../database/db';
import { Bet } from '../../../../database/models/bet.model';

export const betHistory = {
    data: new SlashCommandBuilder().setName('bet-history').setDescription('Vaata oma tehtud panuseid'),
    execute: async (interaction) => {
        const bets = await getUserBets(interaction.user.id);
        if (!bets.length) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole teinud ühtegi panust.`,
                components: [],
                ephemeral: true,
            });
        }
        const profit = await getUserProfit(bets);
        await interaction.reply({
            content: getHistoryDisplay(bets, interaction.user.tag, profit),
            ephemeral: true,
        });
    },
};

async function getUserBets(userId) {
    const bets = await db<Bet>('bets').select().where('userId', userId);
    return bets;
}
export async function getUserProfit(bets: Bet[]) {
    let profit = 0;
    bets.forEach((bet) => {
        const change = bet.amount * bet.odds;
        if (bet.guess === bet.result) {
            profit += change;
        } else {
            profit -= change;
        }
    });
    return profit;
}

function getHistoryDisplay(bets: Bet[], userId: string, profit: number) {
    let index = 0;
    return `${userId}  panused:\n
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
${userId} kasum on ${profit} muumimünti      `;
}
