/* eslint-disable @typescript-eslint/no-unused-vars */
import { type Balance } from '../src/database/models/balance.model.ts';
import { type Bet } from '../src/database/models/bet.model.ts';
import { type DailyCoin } from '../src/database/models/dailyCoin.model.ts';
import { type GameMeta } from '../src/database/models/gameMeta.model.ts';
import { type Loan, LoanPayBack } from '../src/database/models/loan.model.ts';
import { type Player } from '../src/database/models/player.model.ts';
import { type SteveGame, SteveGameStatus } from '../src/database/models/steveGame.model.ts';
import { type Transaction, TransactionType } from '../src/database/models/transactions.model.ts';
import { type User } from '../src/database/models/user.model.ts';

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
    puuid: 'ANAIik9eZimoQKiiM-17G35Z2-_luXWS9jXIFcKk7jUOQuMo7rUwRP2FXgkt4g96Pkiio0W2MtZG9Q',
    //summonerId: 'oED5H6wEe9kzbstCh2yOL7cDOdKgHNXFBKVNhBr-360jVkk',
    //accountId: '1HibEDRrr54umNgG-9RLUyi3RkU6vOH2B8wbpplIr02ccE4',
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
                { puuid: TEST_TRACKED_PLAYER.puuid, gameName: TEST_TRACKED_PLAYER.gameName, teamId: 100 },
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

export function getTestInteraction(overrides?: any) {
    return {
        editReply: (_params: any) => {},
        reply: (_params: any) => {},
        showModal: (_modal: any) => {},
        update: (_params: any) => {},
        options: (_params: any) => {},
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
