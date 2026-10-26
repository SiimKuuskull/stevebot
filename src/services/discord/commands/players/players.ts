import {
    escapeMarkdown,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
} from 'discord.js';
import { findTrackedPlayers } from '../../../../database/queries/player.query.ts';
import { InteractionError } from '../../../../tools/errors.ts';
import { log, LoggerType } from '../../../../tools/logger.ts';
import { parseDatabaseId } from '../../../interaction.service.ts';
import { trackPlayer, untrackPlayer } from '../../../player.service.ts';
import { RIOT_PLATFORM_LABEL } from '../../../riot-games/requests.ts';

export function canManageTracking(interaction: Pick<ChatInputCommandInteraction, 'guildId' | 'memberPermissions'>) {
    const guildId = process.env.DISCORD_SERVER_GUILD_ID;
    return Boolean(
        interaction.guildId &&
        (!guildId || interaction.guildId === guildId) &&
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
    );
}

async function runAdminCommand(interaction: ChatInputCommandInteraction, action: () => Promise<string>) {
    if (!canManageTracking(interaction)) {
        await interaction.reply({
            content: 'Mängijate jälgimist saab muuta ainult selle serveri administraator.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        await interaction.editReply({ content: await action(), allowedMentions: { parse: [] } });
    } catch (error) {
        if (!(error instanceof InteractionError)) {
            log(error, LoggerType.ERROR);
        }
        await interaction.editReply({
            content:
                error instanceof InteractionError
                    ? error.message
                    : 'Mängija jälgimise muutmine ebaõnnestus. Palun proovi hiljem uuesti.',
        });
    }
}

export const trackPlayerCommand = {
    data: new SlashCommandBuilder()
        .setName('track-player')
        .setDescription('Lisa mängija jälgimisele või taasta jälgimine')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName('riot-id')
                .setDescription('Riot ID kujul mängijanimi#tag')
                .setRequired(true)
                .setMaxLength(100),
        )
        .addStringOption((option) =>
            option
                .setName('region')
                .setDescription('Mängija LoL-i regioon')
                .setRequired(true)
                .addChoices({ name: 'EUNE', value: 'EUN1' }, { name: 'EUW', value: 'EUW1' }),
        ),
    execute: async (interaction: ChatInputCommandInteraction) => {
        await runAdminCommand(interaction, async () => {
            const { player, status } = await trackPlayer(
                interaction.options.getString('riot-id', true),
                interaction.options.getString('region', true),
            );
            const name = `[${RIOT_PLATFORM_LABEL[player.platformId]}] ${escapeMarkdown(`${player.gameName}#${player.tagLine}`)}`;
            if (status === 'reactivated') {
                return `Mängija **${name}** jälgimine taastati. Varasemad mängud ja panused säilisid.`;
            }
            if (status === 'updated') {
                return `Mängijat **${name}** juba jälgitakse. Tema andmed on uuendatud.`;
            }
            return `Mängija **${name}** lisati jälgimisele.`;
        });
    },
};

export const untrackPlayerCommand = {
    data: new SlashCommandBuilder()
        .setName('untrack-player')
        .setDescription('Peata mängija jälgimine, säilitades ajaloo')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption((option) =>
            option.setName('player').setDescription('Vali jälgitav mängija').setRequired(true).setAutocomplete(true),
        ),
    autocomplete: async (interaction: AutocompleteInteraction) => {
        if (!canManageTracking(interaction)) {
            await interaction.respond([]);
            return;
        }
        const search = interaction.options.getFocused().toLowerCase();
        const players = await findTrackedPlayers();
        await interaction.respond(
            players
                .map((player) => ({
                    name: `[${RIOT_PLATFORM_LABEL[player.platformId]}] ${player.gameName}#${player.tagLine}`,
                    value: String(player.id),
                }))
                .filter((choice) => choice.name.toLowerCase().includes(search))
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, 25)
                .map((choice) => ({ ...choice, name: choice.name.slice(0, 100) })),
        );
    },
    execute: async (interaction: ChatInputCommandInteraction) => {
        await runAdminCommand(interaction, async () => {
            const id = parseDatabaseId(interaction.options.getString('player', true));
            if (!id) {
                throw new InteractionError('Vali jälgitav mängija nimekirjast.');
            }
            const player = await untrackPlayer(id);
            const name = `[${RIOT_PLATFORM_LABEL[player.platformId]}] ${escapeMarkdown(`${player.gameName}#${player.tagLine}`)}`;
            return `Mängija **${name}** jälgimine peatati. Varasemad andmed säilivad ja pooleliolevate mängude panused lahendatakse. Jälgimise taastamiseks kasuta /track-player.`;
        });
    },
};
