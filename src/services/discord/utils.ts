import { botChannelId, client } from './client';

export function sendChannelMessage(message: string) {
    const channel = client.channels.cache.get(botChannelId);
    (channel as any).send(message);
}
