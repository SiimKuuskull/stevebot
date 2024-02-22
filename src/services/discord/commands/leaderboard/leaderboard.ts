import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder } from 'discord.js';
import lodash, { sumBy } from 'lodash';
import { db } from '../../../../database/db';
import { Balance } from '../../../../database/models/balance.model';
import { getAllResultedBets, getUserBets } from '../../../../database/queries/bets.query';
import { log } from '../../../../tools/logger';
import { getUserProfit } from '../bet-history/bet-history';
import { map } from 'bluebird';

export const leaderboard = {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Vaata, kui palju on muumimünte ringluses!'),
    execute: async (interaction) => {
        const amount = await getAllCurrency();
        const activePlayersBalances = await getAllBalances();
        const allBets = await getAllResultedBets();

        const playerBets = await getBetsWinLossCount();
        if (!activePlayersBalances.length) {
            await interaction.reply({
                content: `Muumiorus pole praegu aktiivseid muumisid, proovi hiljem uuesti!`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        if (sumBy(playerBets.betWins, 'count') === 0 && sumBy(playerBets.betLosses, 'count') === 0) {
            await interaction.reply({
                components: [],
                content: `Hetkel ei ole lõpetatud panuseid`,
                ephemeral: true,
            });
            return;
        }
        let index = 0;
        const profits = await map(activePlayersBalances, async (user) => {
            const bets = await getUserBets(user.user_id);
            const userProfit = await getUserProfit(bets);
            const profits = [user.user_name, userProfit];
            return profits;
        });
        log(profits);
        const leaderboard = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(':trophy: | Edetabel')
            .setAuthor({ name: `Väike Muum vaatas oma andmed üle:` })
            .setDescription('Parimad panustajaid läbi aegade')
            .addFields(
                {
                    name: `Nr.       Nimi:`,
                    value: `${activePlayersBalances
                        .map((balance) => {
                            return `${(index += 1)}. \u2003 \u2003 ${balance.user_name}\n`;
                        })
                        .toString()
                        .replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: `Võidud:`,
                    value: `${activePlayersBalances.map((balance) => {
                        const profit = profits.find((profit) => {
                            return profit[0] === balance.user_name;
                        });
                        return `${profit[1]}\n`;
                    })
                .toString()
                .replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: 'Kogus:',
                    value: `${activePlayersBalances
                        .map((balance) => {
                            return `${balance.amount}\n`;
                        })
                        .toString()
                        .replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: `W/L            Võidu%:`,
                    value: `${activePlayersBalances
                        .map((balance) => {
                            const wins = playerBets.betWins.find((win) => {
                                return balance.user_id === win.user_id;
                            });
                            const losses = playerBets.betLosses.find((loss) => {
                                return balance.user_id === loss.user_id;
                            });
                            const percentage: number = Math.floor(
                                (Number(wins?.count) / (Number(wins?.count) + (Number(losses?.count) || 0))) * 100,
                            );
                            log(`User: ${balance.user_name}: Win rate% ${percentage || 0}%`);
                            return `${wins?.count || 0}/${losses?.count || 0} \u2003 \u2003 \u2005${
                                percentage || 0
                            }%\n`;
                        })
                        .toString()
                        .replaceAll(',', '')}`,
                    inline: true,
                },
            )
            .setTimestamp()
            .setFooter({ text: `Hetkel on ringluses ${amount.sum} muumimünti.` });

        await interaction.reply({
            embeds: [leaderboard],
            ephemeral: true,
        });
    },
};

async function getAllCurrency() {
    const [totalAmount] = await db<Balance>('balance').sum('amount');
    log(`Total balance: ${totalAmount.sum}`);
    return totalAmount;
}
async function getAllBalances() {
    const { rows: allBalances } = await db.raw('SELECT * FROM balance ORDER BY amount DESC');
    allBalances.forEach((user) => {
        log(`User: ${user.user_name} Amount: ${user.amount}`);
    });
    return allBalances;
}
export async function getBetsWinLossCount() {
    const { rows: betWins } = (await db.raw(
        `SELECT user_id, COUNT(*) FROM bets WHERE guess = result AND result != 'IN PROGRESS' GROUP BY user_id`,
    )) as { rows: { user_id: string; count: string }[] };
    const { rows: betLosses } = (await db.raw(
        `SELECT user_id, COUNT(*) FROM bets WHERE guess != result AND result != 'IN PROGRESS' GROUP BY user_id;`,
    )) as { rows: { user_id: string; count: string }[] };
    const betInfo = { betWins, betLosses };
    return betInfo;
}
