import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { createUserBalance, findUserBalance } from '../../../../database/queries/balance.query';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { getActiveLeagueGame } from '../../../game.service';
import { RiotActiveGame } from '../../../riot-games/requests';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Panusta käivasolevale mängule'),
    execute: async (interaction) => {
        const activeGame = await findInprogressGame();

        if (!activeGame) {
            await interaction.reply({ content: 'Ei ole ühtegi mängu.', components: [], ephemeral: true });
            return;
        }
        let balance = await findUserBalance(interaction.user.id);
        if (!balance) {
            balance = await createUserBalance({ userName: interaction.user.tag, userId: interaction.user.id });
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
        let gameStartTime = leagueGame?.gameStartTime;

        if (leagueGame.gameStartTime === 0) {
            gameStartTime = activeGame.createdAt.getTime();
        }
        const gameDisplayLength = getDisplayLength(gameStartTime);
        const betOdds = getBetOdds(leagueGame.gameStartTime);
        await interaction.reply({
            content: `Mängu aeg: **${gameDisplayLength}**\nKoefitsent: **${betOdds}**\nKontoseis: **${balance.amount}** muumimünti\nTee oma panus!`,
            components: [rowMenu],
            ephemeral: true,
        });
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
