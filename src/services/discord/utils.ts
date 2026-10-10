import { botChannelId, client } from './client.ts';

export function sendChannelMessage(message: string) {
    const channel = client.channels.cache.get(botChannelId);
    (channel as any).send(message);
}

export async function sendPrivateMessageToGambler(message: string, userId: string) {
    const user = await client.users.fetch(userId);
    user.send(message);
}

export const discordMessages = {
    sendChannelMessage,
    sendPrivateMessageToGambler,
};
