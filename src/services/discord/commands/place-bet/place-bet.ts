import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRowBuilder, SelectMenuBuilder } from 'discord.js';
import { findInprogressGame } from '../../../../database/queries/steveGames.query';
import { RiotActiveGame } from '../../../riot-games/requests';
import { getActiveLeagueGame } from '../../game';

export const placeBet = {
    data: new SlashCommandBuilder().setName('place-bet').setDescription('Place your bet!'),
    execute: async (interaction) => {
        const activeGame = await findInprogressGame();

        if (!activeGame) {
            await interaction.reply({ content: 'Ei ole ühtegi mängu.', components: [], ephemeral: true });
            return;
        }
        const rowMenu = new ActionRowBuilder().addComponents(
            new SelectMenuBuilder().setCustomId('AMOUNT_SELECTED').setPlaceholder('Panust ei ole!').addOptions(
                {
                    label: '10',
                    description: 'Panustad 10 muumimünti',
                    value: '10',
                },
                {
                    label: '20',
                    description: 'Panustad 20 muumimünti',
                    value: '20',
                },
                {
                    label: '50',
                    description: 'Panustad 50 muumimünti',
                    value: '50',
                },
                {
                    label: '100',
                    description: 'Panustad 100 muumimünti',
                    value: '100',
                },
                {
                    label: 'Muu kogus',
                    description: 'Panusta enda soovitud kogus',
                    value: 'custom',
                },
            ),
        );

        const leagueGame = await getActiveLeagueGame();
        const gameDisplayLength = getDisplayLength(leagueGame);
        const betOdds = getBetOdds(leagueGame.gameLength);
        await interaction.reply({
            content: `Tee oma panus! Steve mängu aeg: ${gameDisplayLength}. Panuse koefitsent on: ${betOdds}  `,
            components: [rowMenu],
            ephemeral: true,
        });
    },
};

function getBetOdds(gameLengthMinutes: number) {
    let odds = 2;
    if (gameLengthMinutes >= 8 && gameLengthMinutes <= 12) {
        odds = 1.6;
    } else if (gameLengthMinutes > 12 && gameLengthMinutes < 20) {
        odds = 1.4;
    } else if (gameLengthMinutes >= 20) {
        odds = 1.1;
    }
    return odds;
}

function getDisplayLength(leagueGame: RiotActiveGame) {
    const currentGameLength = Date.now() - leagueGame.gameStartTime;
    const gameLengthMinutes = Math.floor(currentGameLength / 1000 / 60);
    const gameLengthSeconds = Math.floor(currentGameLength / 1000) % 60;
    const formatGameLength = `${gameLengthMinutes < 10 ? '0' + gameLengthMinutes : gameLengthMinutes}:${
        gameLengthSeconds < 10 ? '0' + gameLengthSeconds : gameLengthSeconds
    }`;
    return formatGameLength;
}
