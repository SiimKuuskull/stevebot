import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { BetResult } from '../../../../database/models/bet.model.ts';
import { getBetsWinLossCount, getUserBets } from '../../../../database/queries/bets.query.ts';
import { log } from '../../../../tools/logger.ts';
import { getUserProfit } from '../../../bet.service.ts';

export const betHistory = {
    data: new SlashCommandBuilder().setName('bet-history').setDescription('Vaata oma tehtud panuseid'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const bets = await getUserBets(interaction.user.id);
        if (!bets.length) {
            await interaction.reply({
                content: `${interaction.user.tag} ei ole teinud ühtegi panust.`,
                components: [],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        const profit = getUserProfit(bets);
        let index = 0;
        const betGuessResult = bets.map((bet) => {
            return `${bet.guess === BetResult.WIN ? 'VÕIDAB' : 'KAOTAB'}\u2003 \u2003 \u2005 ${
                bet.result === BetResult.WIN ? '**VÕITIS**' : '**KAOTAS**'
            }\n`;
        });
        const betInfo = await getBetsWinLossCount();
        const winLossCount = getWinLossById(interaction.user.id, betInfo);
        log(winLossCount);
        const historyMessage = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`:scroll: | Tehtud panused:`)
            .setAuthor({ name: `Väike Muum vaatas oma andmed üle:` })
            .setDescription(`**${interaction.user.tag}** tehtud panused see hooaeg.`)
            .addFields(
                {
                    name: `Nr.`,
                    value: `${bets
                        .map(() => {
                            return `${(index += 1)}.\n`;
                        })
                        .toString()
                        .replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: `Kogus: `,
                    value: `${bets
                        .map((bet) => {
                            return `${bet.amount}\n`;
                        })
                        .toString()
                        .replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: `Panus:               Tulemus:`,
                    value: `${betGuessResult.toString().replaceAll(',', '')}`,
                    inline: true,
                },
                {
                    name: `**Sa oled teinud kokku ${index} panust.**`,
                    value: `${winLossCount}
                     **${interaction.user.tag}** ${profit < 0 ? 'kahjum' : 'kasum'} on **${Math.abs(
                         profit,
                     )}** muumimünti.      `,
                },
            )
            .setTimestamp()
            .setFooter({
                text: `Viimati uuendatud:`,
            });

        await interaction.reply({
            embeds: [historyMessage],
            flags: MessageFlags.Ephemeral,
        });
    },
};

function getWinLossById(
    userId: string,
    bets: {
        betWins: { user_id: string; count: string }[];
        betLosses: { user_id: string; count: string }[];
    },
) {
    const wins = bets.betWins.find((win) => {
        return userId === win.user_id;
    });
    const losses = bets.betLosses.find((loss) => {
        return userId === loss.user_id;
    });
    const winCount = Number(wins?.count) || 0;
    const lossCount = Number(losses?.count) || 0;
    const totalCount = winCount + lossCount;
    const percentage = totalCount ? Math.floor((winCount / totalCount) * 100) : 0;
    return `Panustasid õigesti **${winCount}** korda ning eksisid **${lossCount}** korral. Panustad õigesti **${percentage}%** juhtudel!\n`;
}
