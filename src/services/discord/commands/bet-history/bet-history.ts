import { EmbedBuilder, SlashCommandBuilder } from '@discordjs/builders';
import { db } from '../../../../database/db';
import { Bet, BetResult } from '../../../../database/models/bet.model';
import { log } from '../../../../tools/logger';
import { getBetsWinLossCount } from '../leaderboard/leaderboard';
import { getUserProfit } from '../../../bet.service';

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
            ephemeral: true,
        });
    },
};

export async function getUserBets(userId) {
    const bets = await db<Bet>('bets').select().where('userId', userId).andWhereNot({ result: BetResult.IN_PROGRESS });
    return bets;
}

function getWinLossById(userId: string, bets) {
    const wins = bets.betWins.find((win) => {
        return userId === win.user_id;
    });
    const losses = bets.betLosses.find((loss) => {
        return userId === loss.user_id;
    });
    const percentage: number = Math.floor(
        (Number(wins?.count) / (Number(wins?.count) + (Number(losses?.count) || 0))) * 100,
    );
    return `Panustasid õigesti **${wins?.count || 0}** korda ning eksisid **${
        losses?.count || 0
    }** korral. Panustad õigesti **${percentage}%** juhtudel!\n`;
}
