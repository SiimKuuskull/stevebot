import { expect } from 'chai';
import nock from 'nock';
import {
    addPlatformToMatchId,
    getRiotUserByRiotId,
    RIOT_API_EU_URL,
    toGameId,
} from '../../../src/services/riot-games/requests.ts';

describe('Riot requests', () => {
    context('addPlatformToMatchId', () => {
        it('Should prefix the game ID with its platform', () => {
            expect(addPlatformToMatchId('EUN1', '3218543000')).to.eq('EUN1_3218543000');
            expect(addPlatformToMatchId('EUW1', 3218543000)).to.eq('EUW1_3218543000');
        });
    });
    context('toGameId', () => {
        it('Should strip the platform from a match ID', () => {
            expect(toGameId('EUN1_3218543000')).to.eq('3218543000');
            expect(toGameId('EUW1_3218543000')).to.eq('3218543000');
        });
        it('Should be the inverse of addPlatformToMatchId', () => {
            expect(toGameId(addPlatformToMatchId('EUW1', '7123456789'))).to.eq('7123456789');
        });
    });
    context('getRiotUserByRiotId', () => {
        afterEach(() => {
            nock.cleanAll();
        });
        it('Should URL-encode the game name and tag line', async () => {
            const scope = nock(RIOT_API_EU_URL)
                .get('/riot/account/v1/accounts/by-riot-id/S%C3%B5ber%20Steve/EUW')
                .reply(200, { puuid: 'puuid', gameName: 'Sõber Steve', tagLine: 'EUW' });

            const user = await getRiotUserByRiotId('Sõber Steve', 'EUW');

            expect(scope.isDone()).to.eq(true);
            expect(user?.gameName).to.eq('Sõber Steve');
        });
    });
});
