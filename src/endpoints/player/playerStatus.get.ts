import { findInprogressGame } from '../../database/queries/steveGames.query';

export async function handler() {
    return (await findInprogressGame()) ? 'Online' : 'Offline';
}
