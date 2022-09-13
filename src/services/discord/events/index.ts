import { interactionBetAmount } from './interactionBet/interactionBetAmount';
import { interactionBetDecision } from './interactionBet/interactionBetDecision';
import { interactionCreate } from './interactionCreate/interactionCreate';
import { ready } from './ready/ready';

export const events = [interactionCreate, interactionBetDecision, interactionBetAmount, ready];
