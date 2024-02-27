import { SlashCommandBuilder, StringSelectMenuBuilder } from '@discordjs/builders';
import { ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { BetResult } from '../../../../database/models/bet.model';
import { findUserBalance } from '../../../../database/queries/balance.query';
import { deleteinProgressBet, findUserExistingBet } from '../../../../database/queries/bets.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { placeUserBet } from '../../../bet.service';
import { finishOldInprogressGames, getActiveLeagueGame } from '../../../game.service';
import { createBettingAccount } from '../../../registration.service';
import { RiotActiveGame } from '../../../riot-games/requests';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Panusta käimasolevale mängule'),
    execute: async (interaction) => {
        await finishOldInprogressGames();
        const activeGame = await findInprogressGame();

        if (!activeGame) {
            await interaction.reply({ content: 'Ei ole ühtegi mängu.', components: [], ephemeral: true });
            return;
        }
        let balance = await findUserBalance(interaction.user.id);
        if (!balance) {
            [balance] = await createBettingAccount(interaction.user.id, interaction.user.tag);
        }
        const amounts = ['10', '20', '50', '100'].filter((amount) => Number(amount) <= balance.amount);
        const rowMenu = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder()
                .setCustomId('AMOUNT_SELECTED')
                .setPlaceholder('Panust ei ole!')
                .addOptions(
                    ...amounts.map((amount) => {
                        return {
                            label: amount,
                            description: `Panustad ${amount} muumimünti`,
                            value: amount,
                        };
                    }),
                    {
                        label: 'Muu kogus',
                        description: 'Panusta enda soovitud kogus',
                        value: 'custom',
                    },
                ),
        );

        const leagueGame: RiotActiveGame = await getActiveLeagueGame();
        if (!leagueGame) {
            await interaction.reply({ content: 'Ei ole ühtegi mängu.', components: [], ephemeral: true });
            return;
        }
        let gameStartTime = leagueGame?.gameStartTime;
        if (gameStartTime === 0) {
            gameStartTime = activeGame.createdAt.getTime();
        }
        const existingBet = await findUserExistingBet(interaction.user.id, activeGame.gameId.toString());

        const inprogressBet = existingBet?.guess;
        const inprogressAmount = existingBet?.amount;
        const gameDisplayLengthOvertime = getDisplayLength(gameStartTime);
        const currentGameLength = Date.now() - gameStartTime;
        const TIMELIMIT_MINUTES_IN_MILLISECONDS = 24 * 60 * 1000;
        if (currentGameLength >= TIMELIMIT_MINUTES_IN_MILLISECONDS && !inprogressBet) {
            await interaction.reply({
                content: `Mängu aeg: **${gameDisplayLengthOvertime}**\n
                Mäng on kestnud liiga kaua, et panustada. Oota järgmist mängu!`,
                components: [],
                ephemeral: true,
            });
            return;
        }
        if (!existingBet) {
            const gameDisplayLength = getDisplayLength(gameStartTime);
            const betOdds = getBetOdds(leagueGame.gameStartTime);
            await placeUserBet(interaction.user, 0, activeGame);
            await interaction.reply({
                content: `Mängu aeg: **${gameDisplayLength}**\nKoefitsent: **${betOdds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!`,
                components: [rowMenu],
                ephemeral: true,
            });
            return;
        }
        const gameDisplayLength = getDisplayLength(gameStartTime);
        const betOdds = getBetOdds(leagueGame.gameStartTime);
        if (!inprogressAmount) {
            await placeUserBet(interaction.user, 0, activeGame);
            await interaction.reply({
                content: `Mängu aeg: **${gameDisplayLength}**\nKoefitsent: **${betOdds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!`,
                components: [rowMenu],
                ephemeral: true,
            });
        }
        if (inprogressBet === BetResult.IN_PROGRESS && inprogressAmount === 0) {
            await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
            await placeUserBet(interaction.user, 0, activeGame);
            await interaction.editReply({
                content: `Mängu aeg: **${gameDisplayLength}**\nKoefitsent: **${betOdds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!`,
                components: [rowMenu],
                ephemeral: true,
            });
        } else if (inprogressBet === BetResult.IN_PROGRESS && inprogressAmount !== 0) {
            await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
            await placeUserBet(interaction.user, 0, activeGame);
            await interaction.reply({
                content: `Mängu aeg: **${gameDisplayLength}**\nKoefitsent: **${betOdds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!`,
                components: [rowMenu],
                ephemeral: true,
            });
        } else if (inprogressBet === BetResult.LOSE || inprogressBet === BetResult.WIN) {
            await interaction.reply({
                content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu! :older_man: ',
                components: [],
                ephemeral: true,
            });
        }
    },
};

export function getBetOdds(gameStartTime: number) {
    let odds = 2;
    if (gameStartTime !== 0) {
        const gameLength = Date.now() - gameStartTime;
        const gameLengthMinutes = Math.floor(gameLength / 1000 / 60);

        if (gameLengthMinutes >= 8 && gameLengthMinutes <= 12) {
            odds = 1.6;
        } else if (gameLengthMinutes > 12 && gameLengthMinutes < 20) {
            odds = 1.4;
        } else if (gameLengthMinutes >= 20) {
            odds = 1.1;
        }
        return odds;
    }
    return odds;
}

function getDisplayLength(gameStartTime: number) {
    const currentGameLength = Date.now() - gameStartTime;
    const gameLengthMinutes = Math.floor(currentGameLength / 1000 / 60);
    const gameLengthSeconds = Math.floor(currentGameLength / 1000) % 60;
    const formatGameLength = `${gameLengthMinutes < 10 ? '0' + gameLengthMinutes : gameLengthMinutes}:${
        gameLengthSeconds < 10 ? '0' + gameLengthSeconds : gameLengthSeconds
    }`;
    return formatGameLength;
}
