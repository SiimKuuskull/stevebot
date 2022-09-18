import { Balance } from '../src/database/models/balance.model';
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

export function getTestGameTemplate(overrides?: Partial<SteveGame>) {
    return {
        gameId: 3218543000,
        gameStart: Date.now(),
        gameStatus: SteveGameStatus.IN_PROGRESS,
        ...overrides,
    } as Partial<SteveGame>;
}

export function getTestInteraction() {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        reply: (params) => {},
        user: { ...TEST_DISCORD_USER },
    };
}

export function getTestTrackedPlayerTemplate(overrides?: Partial<Player>) {
    return {
        ...TEST_TRACKED_PLAYER,
        isTracked: true,
        ...overrides,
    } as Partial<Player>;
}
