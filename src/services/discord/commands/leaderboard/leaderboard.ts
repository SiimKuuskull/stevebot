import { SlashCommandBuilder } from '@discordjs/builders';
import { sumBy } from 'lodash';
import { db } from '../../../../database/db';
import { Balance } from '../../../../database/models/balance.model';
import { log } from '../../../../tools/logger';

export const leaderboard = {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Vaata, kui palju on muumimünte ringluses!'),
    execute: async (interaction) => {
        const amount = await getAllCurrency();
        const activePlayersBalances = await getAllBalances();

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
        await interaction.reply({
            content: `Hetkel on ringluses ${amount.sum} muumimünti.
------------------------------------------------------------------
Muumid:                     Kogus :                  W/L                    Võidu %
${activePlayersBalances
    .map((balance) => {
        let result = `${balance.user_name}                        ${balance.amount} `;
        const wins = playerBets.betWins.find((win) => {
            return balance.user_name === win.user_name;
        });
        result += `                 ${wins?.count || 0}/`;
        const losses = playerBets.betLosses.find((loss) => {
            return balance.user_name === loss.user_name;
        });
        result += `${losses?.count || 0}                      `;
        const percentage: number = Math.floor(
            (Number(wins?.count) / (Number(wins?.count) + Number(losses?.count))) * 100,
        );
        result += `${percentage || 0}`;
        log(`User: ${balance.user_name}: Win rate% ${percentage || 0}%`);
        return `${result}\n`;
    })
    .toString()
    .replaceAll(',', '')}
`,
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
async function getBetsWinLossCount() {
    const { rows: betWins } = (await db.raw(
        `SELECT user_name, COUNT(*) FROM bets WHERE guess = result AND result != 'IN PROGRESS' GROUP BY user_name`,
    )) as { rows: { user_name: string; count: string }[] };
    const { rows: betLosses } = (await db.raw(
        `SELECT user_name, COUNT(*) FROM bets WHERE guess != result AND result != 'IN PROGRESS' GROUP BY user_name;`,
    )) as { rows: { user_name: string; count: string }[] };
    const betInfo = { betWins, betLosses };
    log(betInfo);
    return betInfo;
}
