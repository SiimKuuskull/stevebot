import { EmbedBuilder, MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { BetResult } from '../../../../database/models/bet.model.ts';
import { type GameMeta } from '../../../../database/models/gameMeta.model.ts';
import { type Player } from '../../../../database/models/player.model.ts';
import { getBetsWinLossCount, getUserBets, getUserPendingBets } from '../../../../database/queries/bets.query.ts';
import { findTrackedPlayers } from '../../../../database/queries/player.query.ts';
import { log } from '../../../../tools/logger.ts';
import { getUserProfit } from '../../../bet.service.ts';
import { gameMode } from '../../../game.service.ts';

export const betHistory = {
    data: new SlashCommandBuilder().setName('bet-history').setDescription('Vaata oma tehtud panuseid'),
    execute: async (interaction: ChatInputCommandInteraction) => {
        const bets = await getUserBets(interaction.user.id);
        if (!bets.length) {
            const pendingBets = await getUserPendingBets(interaction.user.id);
            if (pendingBets.length) {
                const trackedPlayers = await findTrackedPlayers();
                const pendingList = pendingBets
                    .map((bet, i) => {
                        const gameMode = getPendingGameMode(bet.meta, trackedPlayers);
                        return `${i + 1}. ${gameMode ? `${gameMode}: ` : ''}**${bet.guess === BetResult.WIN ? 'VÕIDAB' : 'KAOTAB'}** — ${Math.round(bet.amount * bet.odds)} muumimünti`;
                    })
                    .join('\n');
                await interaction.reply({
                    content: `:face_with_peeking_eye: **${interaction.user.tag}** muumimündid on järgmistes mängudes:\n${pendingList}`,
                    components: [],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
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
            const result =
                bet.result === BetResult.VOID ? 'TÜHISTATUD' : bet.result === BetResult.WIN ? 'VÕITIS' : 'KAOTAS';
            return `${bet.guess === BetResult.WIN ? 'VÕIDAB' : 'KAOTAB'}\u2003 \u2003 \u2005 **${result}**\n`;
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

function getPendingGameMode(meta: GameMeta['meta'] | null, players: Player[]) {
    if (!meta) {
        return '';
    }
    const player = players.find((p) => meta.participants.some((participant) => participant.puuid === p.puuid));
    const matchType = gameMode[meta.gameQueueConfigId];
    const label = [player && `**${player.gameName}**`, matchType && `(${matchType})`].filter(Boolean).join(' ');
    return label;
}

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
