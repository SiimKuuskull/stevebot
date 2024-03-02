import { getLastSeenPlayer } from '../../database/queries/steveGames.query';
import { Duration } from 'luxon';

export async function handler() {
    const lastSeenEpoch: number = await getLastSeenPlayer();
    const lastSeenMilliseconds = Date.now() - lastSeenEpoch;

    function formatDuration(milliseconds: number): string {
        const duration: Duration = Duration.fromMillis(milliseconds);
        const formattedDuration: string = duration.toFormat("d'd' hh'h' mm'm' ss's'");

        return formattedDuration;
    }
    const durationInMilliseconds: number = lastSeenMilliseconds;
    const lastSeenDuration: string = formatDuration(durationInMilliseconds);
    return lastSeenDuration;
}
