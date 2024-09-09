import { findUserBalance } from '../../../database/queries/balance.query';
import { createBettingAccount } from '../../registration.service';
import { betHistory } from './bet-history/bet-history';
import { dailyCoin } from './daily-coin/daily-coin';
import { helpCommand } from './help/help';
import { leaderboard } from './leaderboard/leaderboard';
import { myBalance } from './my-balance/my-balance';
import { myBet } from './my-bet/my-bet';
import { placeBet } from './place-bet/place-bet';

export const commands: Command[] = [helpCommand, myBalance, placeBet, myBet, leaderboard, betHistory, dailyCoin].map(
    (command) => makeCommand(command),
);

function makeCommand(command) {
    return {
        data: command.data,
        execute: async (interaction) => {
            if (!command.accountRequired) {
                return command.execute(interaction);
            }
            const balance = await findUserBalance(interaction.user.id);
            if (!balance) {
                const [balance] = await createBettingAccount(interaction.user.id, interaction.user.tag);
                await interaction.reply({
                    content: `Tere tulemast kasutama Stevebot'i. Esimese kohtumise puhul saad hoopis **${balance.amount}** muumimünti enda uuele kontole. GL!`,
                    ephemeral: true,
                });
                return;
            }
            return command.execute(interaction, balance);
        },
    };
}

type Command = { data: any; execute: (interaction) => void | Promise<void> };
