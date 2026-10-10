import { findInprogressGame } from '../../database/queries/steveGames.query.ts';

export async function handler() {
    return (await findInprogressGame()) ? 'Online' : 'Offline';
}
