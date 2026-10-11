import { EmbedBuilder, MessageFlags, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import lodash from 'lodash';
import { getAllBalances, getAllCurrency } from '../../../../database/queries/balance.query.ts';
import { getBetsWinLossCount, getUserBets } from '../../../../database/queries/bets.query.ts';
import { log } from '../../../../tools/logger.ts';
import Bluebird from 'bluebird';
import { getUserProfit } from '../../../bet.service.ts';

export const leaderboard = {
    data: new SlashCommandBuilder().setName('leaderboard').setDescription('Vaata, kui palju on muumimünte ringluses!'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const amount = await getAllCurrency();
        const activePlayersBalances = await getAllBalances();

        const playerBets = await getBetsWinLossCount();
        if (!activePlayersBalances.length) {
            await interaction.reply({
                content: `Muumiorus pole praegu aktiivseid muumisid, proovi hiljem uuesti!`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        if (lodash.sumBy(playerBets.betWins, 'count') === 0 && lodash.sumBy(playerBets.betLosses, 'count') === 0) {
            await interaction.reply({
                components: [],
                content: `Hetkel ei ole lõpetatud panuseid`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        let index = 0;
        const profits = await Bluebird.map(
            activePlayersBalances,
            async (user) => {
                const bets = await getUserBets(user.userId);
                const userProfit = getUserProfit(bets);
                const profits = [user.userName, userProfit];
                return profits;
            },
            { concurrency: 5 },
        );
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
                            return `${(index += 1)}. \u2003 \u2003 ${balance.userName}\n`;
                        })
                        .toString()
                        .replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: `Võidud:`,
                    value: `${activePlayersBalances
                        .map((balance) => {
                            const profit = profits.find((profit) => {
                                return profit[0] === balance.userName;
                            });
                            return `${profit?.[1]}\n`;
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
                                return balance.userId === win.user_id;
                            });
                            const losses = playerBets.betLosses.find((loss) => {
                                return balance.userId === loss.user_id;
                            });
                            const percentage: number = Math.floor(
                                (Number(wins?.count) / (Number(wins?.count) + (Number(losses?.count) || 0))) * 100,
                            );
                            log(`User: ${balance.userName}: Win rate% ${percentage || 0}%`);
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
            flags: MessageFlags.Ephemeral,
        });
    },
};
