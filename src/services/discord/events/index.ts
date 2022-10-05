import { interactionBankrupt } from './interactionBankrupt/interactionBankrupt';
import { interactionBetAmount } from './interactionBet/interactionBetAmount';
import { interactionCustomBetAmount } from './interactionBet/interactionBetCustomAmount';
import { interactionBetDecision } from './interactionBet/interactionBetDecision';
import { interactionCreate } from './interactionCreate/interactionCreate';
import { ready } from './ready/ready';

export const events = [
    interactionCreate,
    interactionBetDecision,
    interactionCustomBetAmount,
    interactionBetAmount,
    interactionBankrupt,
    ready,
];
