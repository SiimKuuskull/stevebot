import { SlashCommandBuilder } from '@discordjs/builders';
import { BaseInteraction } from 'discord.js';
import { round } from 'lodash';
import { db } from '../../../../database/db';
import { Bet, BetResult } from '../../../../database/models/bet.model';

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
            return;
        }
        const profit = await getUserProfit(bets);
        await interaction.reply({
            content: getHistoryDisplay(bets, profit, interaction),
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
        if (bet.result !== BetResult.IN_PROGRESS) {
            const change = bet.amount * bet.odds;
            if (bet.guess === bet.result) {
                profit += change;
            } else {
                profit -= bet.amount;
            }
        }
    });
    return round(profit, 2);
}

function getHistoryDisplay(bets: Bet[], profit: number, interaction: BaseInteraction) {
    let index = 0;
    return `${interaction.user.tag}  panused:\n
    Kogus:          Koefitsent:          Pakkumine:              Tulemus:
${bets
    .map((bet) => {
        const result = `
${(index += 1)}.       ${bet.amount}                     ${bet.odds}                       ${
            bet.guess === BetResult.WIN ? '**VÕIT**' : '**KAOTUS**'
        }                   ${bet.result === BetResult.WIN ? '**VÕIT**' : '**KAOTUS**'} \n`;
        return `${result}`;
    })
    .toString()
    .replaceAll(',', '')}
${interaction.user.tag} ${profit < 0 ? 'kahjum' : 'kasum'} on **${Math.abs(profit)}** muumimünti      `;
}
