import { helpCommand } from './help/help';
import { moominCoin } from './moomincoin/moomincoin';
import { myBalance } from './my-balance/my-balance';
import { myBet } from './my-bet/my-bet';
import { placeBet } from './place-bet/placeBet';

export const commands = [helpCommand, myBalance, placeBet, myBet, moominCoin];
