import { findTrackedPlayer } from '../../database/queries/player.query';
import { getRiotUserRankedEntries } from '../../services/riot-games/requests';

interface PlayerRankedEntries {
    rankedFlex: object;
    rankedSolo: object;
}
export async function handler() {
    const player = await findTrackedPlayer();
    console.log(player.summonerId);
    const playerRankedEntries: PlayerRankedEntries = await getRiotUserRankedEntries(player.summonerId);
    console.log(playerRankedEntries);
    return playerRankedEntries;
}
