import { ActionRowBuilder, MessageFlags, SelectMenuBuilder, SlashCommandBuilder } from 'discord.js';
import { BetResult } from '../../../../database/models/bet.model.ts';
import { deleteinProgressBet, findUserExistingBet } from '../../../../database/queries/bets.query.ts';
import { findInprogressGame } from '../../../../database/queries/steveGames.query.ts';
import { placeUserBet } from '../../../bet.service.ts';
import { getActiveLeagueGame } from '../../../game.service.ts';
import { useBettingAccount } from '../../../registration.service.ts';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Panusta käimasolevale mängule'),
    execute: async (interaction: any) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const activeGame = await findInprogressGame();

        if (!activeGame) {
            await interaction.editReply({ content: 'Ei ole ühtegi mängu.', components: [] });
            return;
        }
        const { balance } = await useBettingAccount(interaction.user);
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

        const leagueGame = await getActiveLeagueGame();
        if (!leagueGame) {
            await interaction.editReply({ content: 'Ei ole ühtegi mängu.', components: [] });
            return;
        }
        let gameStartTime = leagueGame?.gameStartTime;
        if (gameStartTime === 0) {
            gameStartTime = activeGame.createdAt.getTime();
        }
        const existingBet = await findUserExistingBet(interaction.user.id, activeGame.gameId.toString());

        const inprogressBet = existingBet?.guess;
        const inprogressAmount = existingBet?.amount;
        const gameDisplayLength = getDisplayLength(gameStartTime);
        const currentGameLength = Date.now() - gameStartTime;
        const TIMELIMIT_MINUTES_IN_MILLISECONDS = 24 * 60 * 1000;
        if (currentGameLength >= TIMELIMIT_MINUTES_IN_MILLISECONDS && !inprogressBet) {
            await interaction.editReply({
                content: `Mängu aeg: **${gameDisplayLength}**\n
                Mäng on kestnud liiga kaua, et panustada. Oota järgmist mängu!`,
                components: [],
            });
            return;
        }
        const betOdds = getBetOdds(leagueGame.gameStartTime);
        const oddsReply = {
            content: `Mängu aeg: **${gameDisplayLength}**\nKoefitsent: **${betOdds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!`,
            components: [rowMenu],
        };
        if (inprogressBet === BetResult.IN_PROGRESS) {
            await deleteinProgressBet(interaction.user.id, BetResult.IN_PROGRESS);
            await placeUserBet(balance, 0, activeGame);
            await interaction.editReply(oddsReply);
        } else if (!existingBet || !inprogressAmount) {
            await placeUserBet(balance, 0, activeGame);
            await interaction.editReply(oddsReply);
        } else {
            await interaction.editReply({
                content: 'Oled juba panuse teinud sellele mängule! Oota järgmist mängu! :older_man: ',
                components: [],
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
