import { getBetUserId } from '../../database/queries/balance.query';
import { botChannelId, client } from './client';

export function sendChannelMessage(message: string) {
    const channel = client.channels.cache.get(botChannelId);
    (channel as any).send(message);
}

export async function sendPrivateMessageToGambler(message: string, userName: string) {
    const gamblerId = await getBetUserId(userName);
    const user = await client.users.fetch(gamblerId);
    user.send(message);
    return console.log(`Message delivered to ${userName}!`);
}
