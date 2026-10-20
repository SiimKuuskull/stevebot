import { log, LoggerType } from '../../tools/logger.ts';
import { botChannelId, client } from './client.ts';

export async function sendChannelMessage(message: string) {
    try {
        const channel = client.channels.cache.get(botChannelId);
        await (channel as any).send(message);
    } catch (error) {
        log(`Failed to send channel message: ${(error as Error).message}`, LoggerType.ERROR);
    }
}

export async function sendPrivateMessageToGambler(message: string, userId: string) {
    try {
        const user = await client.users.fetch(userId);
        await user.send(message);
    } catch (error) {
        log(`Failed to send private message to ${userId}: ${(error as Error).message}`, LoggerType.ERROR);
    }
}

export const discordMessages = {
    sendChannelMessage,
    sendPrivateMessageToGambler,
};
