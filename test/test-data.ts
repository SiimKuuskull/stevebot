import { Balance } from '../src/database/models/balance.model';
import { Bet } from '../src/database/models/bet.model';
import { Loan, LoanPayBack } from '../src/database/models/loan.model';
import { Player } from '../src/database/models/player.model';
import { SteveGame, SteveGameStatus } from '../src/database/models/steveGame.model';

export const TEST_DISCORD_USER = {
    id: 'Siim#9027',
    tag: 'Siim',
};

export const TEST_TRACKED_PLAYER = {
    accountId: 'eiW8NG7hP9Z_G4f7q6naMJqkQjQunQIgiuEANj2pggP6TjI',
    id: 'QdOpGBp4vSMBYbVgrW7gr3A4P2DBsAakR3qvwDgScDJCKxY',
    name: 'z4pcb3IA23axhkOtADXpLMm9ISANc3r40YmTuLKjOd6GyJscbtW2nCxllL2cehzobM9JMgJ-sIXfpg',
    puuid: 'Loviatar',
};

export function getTestBalanceTemplate(overrides?: Partial<Balance>) {
    return {
        userId: TEST_DISCORD_USER.id,
        userName: TEST_DISCORD_USER.tag,
        ...overrides,
    } as Partial<Balance>;
}

export function getTestBetTemplate(overrides?: Partial<Bet>) {
    return {
        amount: 10,
        gameId: 3218543000,
        gameStart: Date.now(),
        odds: 2,
        userId: TEST_DISCORD_USER.id,
        userName: TEST_DISCORD_USER.tag,
        ...overrides,
    } as Partial<Bet>;
}

export function getTestGameTemplate(overrides?: Partial<SteveGame>) {
    return {
        gameId: 3218543000,
        gameStart: Date.now(),
        gameStatus: SteveGameStatus.IN_PROGRESS,
        ...overrides,
    } as Partial<SteveGame>;
}
export function getTestFinishedGameTemplate(overrides?: Partial<SteveGame>) {
    return {
        gameId: 31102452000,
        gameStart: Date.now(),
        gameStatus: SteveGameStatus.COMPLETED,
        ...overrides,
    } as Partial<SteveGame>;
}

export function getTestInteraction(overrides?) {
    return {
        editReply: (params) => {},
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        reply: (params) => {},
        showModal: (modal) => {},
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        update: (params) => {},
        user: { ...TEST_DISCORD_USER },
        ...overrides,
    };
}

export function getTestTrackedPlayerTemplate(overrides?: Partial<Player>) {
    return {
        ...TEST_TRACKED_PLAYER,
        isTracked: true,
        ...overrides,
    } as Partial<Player>;
}

export function getUnresolvedTestLoanTemplate(overrides?: Partial<Loan>) {
    return {
        userId: TEST_DISCORD_USER.id,
        userName: TEST_DISCORD_USER.tag,
        amount: 1000,
        deadline: new Date(Date.now() + 2000),
        payback: LoanPayBack.UNRESOLVED,
        ...overrides,
    } as Partial<Loan>;
}

export function getPastDeadlineTestLoanTemplate(overrides?: Partial<Loan>) {
    return {
        userId: TEST_DISCORD_USER.id,
        userName: TEST_DISCORD_USER.tag,
        amount: 1000,
        deadline: new Date(Date.now() - 2000),
        payback: LoanPayBack.UNRESOLVED,
        ...overrides,
    } as Partial<Loan>;
}

export function getResolvedTestLoanTemplate(overrides?: Partial<Loan>) {
    return {
        userId: TEST_DISCORD_USER.id,
        userName: TEST_DISCORD_USER.tag,
        amount: 1000,
        deadline: new Date(Date.now() + 2000),
        payback: LoanPayBack.RESOLVED,
        ...overrides,
    } as Partial<Loan>;
}
