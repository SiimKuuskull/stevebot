import { Balance } from '../src/database/models/balance.model';

export const TEST_DISCORD_USER = {
    id: 'Siim#9027',
    tag: 'Siim',
};

export function getTestBalanceTemplate(overrides?: Partial<Balance>) {
    return {
        userId: TEST_DISCORD_USER.id,
        userName: TEST_DISCORD_USER.tag,
        ...overrides,
    } as Partial<Balance>;
}

export function getTestInteraction() {
    return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        reply: (params) => {},
        user: { ...TEST_DISCORD_USER },
    };
}
