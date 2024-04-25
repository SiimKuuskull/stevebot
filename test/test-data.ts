/* eslint-disable @typescript-eslint/no-unused-vars */
import { Balance } from '../src/database/models/balance.model';
import { Bet } from '../src/database/models/bet.model';
import { DailyCoin } from '../src/database/models/dailyCoin.model';
import { GameMeta } from '../src/database/models/gameMeta.model';
import { Loan, LoanPayBack } from '../src/database/models/loan.model';
import { Player } from '../src/database/models/player.model';
import { SteveGame, SteveGameStatus } from '../src/database/models/steveGame.model';
import { Transaction, TransactionType } from '../src/database/models/transactions.model';
import { User } from '../src/database/models/user.model';
import { STEVE } from '../src/services/steve.service';

export const TEST_DISCORD_USER = {
    id: 'Siim#9027',
    tag: 'Siim',
};
export const TEST_DISCORD_USER_2 = {
    id: 'Mihkel#3030',
    tag: 'Mihkel',
};
export const TEST_DISCORD_USER_3 = {
    id: 'Juhan#2222',
    tag: 'Juhan',
};
export const TEST_DISCORD_USER_4 = {
    id: 'Marii#1111',
    tag: 'Marii',
};
export const TEST_TRACKED_PLAYER = {
    gameName: 'Loviatar',
    tagLine: '0001',
    puuid: 'z4pcb3IA23axhkOtADXpLMm9ISANc3r40YmTuLKjOd6GyJscbtW2nCxllL2cehzobM9JMgJ-sIXfpg',
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
        ...overrides,
    } as Partial<Bet>;
}

export function getTestDailyCoinTemplate(overrides?: Partial<DailyCoin>) {
    return {
        userId: TEST_DISCORD_USER.id,
        ...overrides,
    };
}

export function getTestGameMetaTemplate(steveGameId: number, overrides?: Partial<GameMeta>) {
    return {
        meta: {
            participants: [
                { puuid: STEVE.puuid, gameName: STEVE.gameName, teamId: 100 },
                {
                    puuid: 'XGO_nv1F4Wl_1Mai-mAaPSdJCH9Mv52lg_ws2JwdoRg7Ipo',
                    gameName: 'Mìhkel',
                    teamId: 100,
                },
                {
                    puuid: 'CFjGY_Rgw-AOzEbuIU8EE6ly8UZNRxpfVj7T4vGLeli3GVo',
                    gameName: 'jumpermaku',
                    teamId: 200,
                },
            ],
        },
        steveGameId,
        ...overrides,
    } as Partial<GameMeta>;
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

export function getTestTransactionTemplate(overrides?: Partial<Transaction>) {
    return {
        amount: 10,
        balance: 110,
        externalTransactionId: 1,
        type: TransactionType.DAILY_COIN,
        userId: TEST_DISCORD_USER.id,
        ...overrides,
    };
}

export function getTestUserTemplate(overrides?: Partial<User>) {
    return {
        id: TEST_DISCORD_USER.id,
        name: TEST_DISCORD_USER.tag,
        gameName: 'Loviatar',
        tagLine: '0001',
        puuid: 'QdOpGBp4vSMBYbVgrW7gr3A4P2DBsAakR3qvwDgScDJCKxY',
        ...overrides,
    } as Partial<User>;
}

export function getTestInteraction(overrides?) {
    return {
        editReply: (params) => {},
        reply: (params) => {},
        showModal: (modal) => {},
        update: (params) => {},
        options: (params) => {},
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
        amount: 1000,
        deadline: new Date(Date.now() + 2000),
        payback: LoanPayBack.UNRESOLVED,
        ...overrides,
    } as Partial<Loan>;
}

export function getPastDeadlineTestLoanTemplate(overrides?: Partial<Loan>) {
    return {
        userId: TEST_DISCORD_USER.id,
        amount: 1000,
        deadline: new Date(Date.now() - 2000),
        payback: LoanPayBack.UNRESOLVED,
        ...overrides,
    } as Partial<Loan>;
}

export function getResolvedTestLoanTemplate(overrides?: Partial<Loan>) {
    return {
        userId: TEST_DISCORD_USER.id,
        amount: 1000,
        deadline: new Date(Date.now() + 2000),
        payback: LoanPayBack.RESOLVED,
        ...overrides,
    } as Partial<Loan>;
}
