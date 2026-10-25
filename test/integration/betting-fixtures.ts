import nock from 'nock';
import { BetResult } from '../../src/database/models/bet.model.ts';
import { type BettingGame } from '../../src/services/bet.service.ts';
import { bettingCustomId, type BettingAction } from '../../src/services/interaction.service.ts';
import { RIOT_API_EU_URL, RIOT_PLATFORM_URL } from '../../src/services/riot-games/requests.ts';
import {
    getTestBalanceTemplate,
    getTestBetTemplate,
    getTestGameTemplate,
    getTestGameMetaTemplate,
    getTestTrackedPlayerTemplate,
    getTestUserTemplate,
    TEST_DISCORD_USER,
} from '../test-data.ts';
import { testDb } from './init.ts';

export async function bettingFixture(
    options: { suffix?: string; amount?: number; startTime?: number; team?: number; platformId?: 'EUN1' | 'EUW1' } = {},
) {
    const suffix = options.suffix ?? 'first';
    const startTime = options.startTime ?? Date.now();
    const [player] = await testDb('player')
        .insert(
            getTestTrackedPlayerTemplate({
                puuid: `owner-${suffix}`,
                gameName: `Player-${suffix}`,
                platformId: options.platformId ?? 'EUN1',
            }),
        )
        .returning('*');
    const [game] = await testDb('steve_games')
        .insert(getTestGameTemplate({ playerId: player.id, platformId: player.platformId, gameStart: startTime }))
        .returning('*');
    await testDb('users')
        .insert(getTestUserTemplate({ puuid: 'bettor' }))
        .onConflict('id')
        .ignore();
    await testDb('balance')
        .insert(getTestBalanceTemplate({ amount: 100 }))
        .onConflict('userId')
        .ignore();
    const meta = getTestGameMetaTemplate(game.id).meta!;
    meta.participants = [
        { ...meta.participants[0], puuid: player.puuid, teamId: 100 },
        ...(options.team ? [{ ...meta.participants[1], puuid: 'bettor', teamId: options.team }] : []),
    ];
    await testDb('game_meta').insert({ steveGameId: game.id, meta });
    const [bet] = await testDb('bets')
        .insert(
            getTestBetTemplate({
                steveGameId: game.id,
                amount: options.amount ?? 0,
                guess: BetResult.IN_PROGRESS,
                result: BetResult.IN_PROGRESS,
            }),
        )
        .returning('*');
    const context: BettingGame = { player, game, startTime };
    const reference = { steveGameId: game.id, betId: bet.id };
    return {
        ...context,
        meta,
        context,
        bet,
        reference,
        userId: TEST_DISCORD_USER.id,
        customId: (action: BettingAction, odds?: number) => bettingCustomId(action, reference, odds),
    };
}

export function mockLiveGame(
    context: BettingGame,
    options: { times?: number; finished?: boolean; startTime?: number } = {},
) {
    const { player, game } = context;
    nock(RIOT_PLATFORM_URL[player.platformId])
        .get(`/lol/spectator/v5/active-games/by-summoner/${player.puuid}`)
        .times(options.times ?? 1)
        .reply(200, {
            gameId: Number(game.gameId),
            platformId: game.platformId,
            gameStartTime: options.startTime ?? context.startTime,
            participants: [],
        });
    nock(RIOT_API_EU_URL)
        .get(`/lol/match/v5/matches/by-puuid/${player.puuid}/ids`)
        .times(options.times ?? 1)
        .reply(200, options.finished ? [`${game.platformId}_${game.gameId}`] : []);
}
