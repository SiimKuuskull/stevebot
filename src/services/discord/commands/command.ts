import { betHistory } from './bet-history/bet-history.ts';
import { dailyCoin } from './daily-coin/daily-coin.ts';
import { helpCommand } from './help/help.ts';
import { leaderboard } from './leaderboard/leaderboard.ts';
import { myBalance } from './my-balance/my-balance.ts';
import { myBet } from './my-bet/my-bet.ts';
import { placeBet } from './place-bet/place-bet.ts';

export const commands = [helpCommand, myBalance, placeBet, myBet, leaderboard, betHistory, dailyCoin];
