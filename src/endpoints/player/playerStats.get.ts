import { findTrackedPlayer } from '../../database/queries/player.query';
import { getRiotUserRankedEntries } from '../../services/riot-games/requests';

interface PlayerRankedEntries {
    rankedFlex: object;
    rankedSolo: object;
}
//TODO when player hasnt completed placements API returns empty [], getRecentMatches ja sealt filtreerida W/R kui placementid ja loogika
export async function handler() {
    const player = await findTrackedPlayer();
    const playerRankedEntries: PlayerRankedEntries = await getRiotUserRankedEntries(player.summonerId);
    return playerRankedEntries;
}
