import { bankruptcy } from './bankruptcy/bankruptcy';
import { betHistory } from './bet-history/bet-history';
import { helpCommand } from './help/help';
import { leaderboard } from './leaderboard/leaderboard';
import { myBalance } from './my-balance/my-balance';
import { myBet } from './my-bet/my-bet';
import { placeBet } from './place-bet/placeBet';

export const commands = [helpCommand, myBalance, placeBet, myBet, leaderboard, betHistory, bankruptcy];
