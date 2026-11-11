require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;

const axios = require('axios');
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    ChannelType,
    PermissionsBitField
} = require('discord.js');
const http = require('http');

// Simple HTTP server to keep the bot alive on Render / UptimeRobot
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Multi-Platform Tip Rain Monitor & Ticket Bot is running 24/7!\n');
});
server.listen(8080, () => {
    console.log('[SYS] HTTP server listening on port 8080');
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const CHANNELS = {
    DONUTDROP_ALERT: '1565799962934251653',
    DONUTDSURGE_ALERT: '1565800116663623710',
    DONUTSTAKE_ALERT: '1565879909870735430',
    ROLE_SELECT: '1565826447833170122',
    TICKET_PANEL: '1566427140138868786'
};

const CATEGORIES = {
    TICKET_CATEGORY: '1566194828545364059'
};

const ROLES = {
    DONUTDROP_PING: '1565836541597851748',
    DONUTSURGE_PING: '1565836388128133342',
    DONUTSTAKE_PING: '1565882472607129801',
    AUTO_ROLE: '1565837276322463806',
    GIVEAWAY_WINNER: '1566429754159013919'
};

const activeGiveaways = new Map();

const DONUTDROP_CONFIG = {
    url: 'https://donutdrop.net/api/rain',
    headers: {
        'Accept': '*/*',
        'Cookie': 'connect.sid=s%3AAv3jegRdlp2qM8hNWN1pQB4oEXemk_W5.K%2BuJ9jaj2FeIOcUCbSLgfl2mwNy98XMOuZGRIYaITFs; dd_dev=4a-Hedj5R1ZJFp4K9JP9qLmH',
        'Referer': 'https://donutdrop.net/account/fairness',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0'
    }
};

const DONUTDSURGE_CONFIG = {
    url: 'https://donutsurge.com/api/rain',
    headers: {
        'Accept': '*/*',
        'Cookie': 'donutsurge_session=f1d48ddfb1a4f56a06a00c3a966630395ae93584debe5dd78a22b85d400a3c45; donutsurge_browser=4f3aea6d-75d2-4a09-ad13-78ff04301739; cf_clearance=CssexDc7RjWA_gOm2SH1o9daGnNyJln8BaAE1h6uf0LgG4blKcu0mKE9sdT9BmQPWT1uyvRnkI7dPlGRWQiknD4ecaveEI2fDd6tUeuAgagcOfa-cntEHgaCVj5QvsvelD2CiNpWQ0eb7DFhK85SSM6hIWiSJ94fPLThW0YbfbaA6KbB8Py6xR3Fo0y-iFSzAj0zdpoE0hItlmgz0lgGV4GBWkDN7oxGJcqHlcUy4cCCWbcDxOfnE05ixitKejxNK3u4M_VDXPbjf-YlqS57sk8VQOvRWcY81E8i9d0SBWKMtBOHImVlCX_7',
        'Referer': 'https://donutsurge.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0'
    }
};

const DONUTSTAKE_CONFIG = {
    url: 'https://api.donutstake.com/rain/info',
    headers: {
        'Accept': '*/*',
        'Referer': 'https://donutstake.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0'
    }
};

const activeRainMessageIds = { donutdrop: null, donutsurge: null, donutstake: null };
const lastRefreshTimestamp = { donutdrop: 0, donutsurge: 0, donutstake: 0 };

function formatDonutsurgeData(data) {
    const openData = data.open || data.rain || data;
    const rawPot = openData.amount || openData.pot || data.pot || 0;
    const pot = rawPot > 1000000 ? (rawPot / 1000000000).toFixed(1) + 'B Money' : (rawPot > 1000 ? (rawPot / 1000000).toFixed(1) + 'M Money' : rawPot + ' Money');
    
    let timeLeftString = '';
    let timeString = 'Unknown';
    const remainingMs = openData.remainingMs || openData.endsIn || 0;

    if (remainingMs > 0) {
        const closeDate = new Date(Date.now() + remainingMs);
        timeString = closeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

        const diffMs = closeDate - new Date();
        if (diffMs > 0) {
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            timeLeftString = diffMins > 0 ? ` (${diffMins} min left)` : ` (${diffSecs}s left)`;
        } else {
            timeLeftString = ` (Ending now)`;
        }
    }

    return `<@&${ROLES.DONUTSURGE_PING}>\n` +
            `> 🎁 **DONUTSURGE TIP RAIN IS ACTIVE!**\n` +
            `> ═════════════════════════════\n` +
            `> 💰 **Pool Amount:** \`${pot}\`\n` +
            `> ⏳ **Ends At:** \`${timeString}\` *${timeLeftString}*\n` +
            `> ═════════════════════════════`;
}

function formatDonutstakeData(data) {
    const rawPot = data.poolAmount || 0;
    const pot = rawPot > 1000000 ? (rawPot / 1000000000).toFixed(1) + 'B Money' : (rawPot > 1000 ? (rawPot / 1000000).toFixed(1) + 'M Money' : rawPot + ' Money');
    
    let timeLeftString = '';
    let timeString = 'Unknown';
    const endsAtTimestamp = data.rainEndsAt || data.nextRainAt || 0;

    if (endsAtTimestamp > 0) {
        const closeDate = new Date(endsAtTimestamp);
        if (!isNaN(closeDate.getTime())) {
            timeString = closeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
            const diffMs = closeDate - Date.now();
            if (diffMs > 0) {
                const diffMins = Math.floor(diffMs / 60000);
                const diffSecs = Math.floor((diffMs % 60000) / 1000);
                timeLeftString = diffMins > 0 ? ` (${diffMins} min left)` : ` (${diffSecs}s left)`;
            } else {
                timeLeftString = ` (Ending now)`;
            }
        }
    }

    return `<@&${ROLES.DONUTSTAKE_PING}>\n` +
            `> 🎁 **DONUTSTAKE TIP RAIN IS ACTIVE!**\n` +
            `> ═════════════════════════════\n` +
            `> 💰 **Pool Amount:** \`${pot}\`\n` +
            `> ⏳ **Ends At:** \`${timeString}\` *${timeLeftString}*\n` +
            `> ═════════════════════════════`;
}

function formatStandardRainData(rainObj, data, platformName, roleId) {
    const rawPot = rainObj.potRaw || rainObj.pool || data.amount || rainObj.amount || rainObj.pot || 0;
    const pot = rawPot > 1000000 ? (rawPot / 1000000000).toFixed(1) + 'B Money' : (rawPot > 1000 ? (rawPot / 1000000).toFixed(1) + 'M Money' : rawPot + ' Money');
    
    let timeString = 'Unknown';
    let timeLeftString = '';

    const closesAtTime = rainObj.closesAt || rainObj.endsAt || data.endsIn || rainObj.expiresAt;
    if (closesAtTime) {
        let closeDate;
        if (typeof closesAtTime === 'number' && closesAtTime < 86400000) {
            closeDate = new Date(Date.now() + closesAtTime);
        } else {
            closeDate = new Date(closesAtTime);
        }

        if (!isNaN(closeDate.getTime())) {
            timeString = closeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
            
            const diffMs = closeDate - new Date();
            if (diffMs > 0) {
                const diffMins = Math.floor(diffMs / 60000);
                const diffSecs = Math.floor((diffMs % 60000) / 1000);
                timeLeftString = diffMins > 0 ? ` (${diffMins} min left)` : ` (${diffSecs}s left)`;
            } else {
                timeLeftString = ` (Ending now)`;
            }
        } else {
            timeString = closesAtTime;
        }
    }

    return `<@&${roleId}>\n` +
            `> 🎁 **${platformName.toUpperCase()} TIP RAIN IS ACTIVE!**\n` +
            `> ═════════════════════════════\n` +
            `> 💰 **Pool Amount:** \`${pot}\`\n` +
            `> ⏳ **Ends At:** \`${timeString}\` *${timeLeftString}*\n` +
            `> ═════════════════════════════`;
}

async function sendRoleSelectPanel() {
    try {
        const roleChannel = await client.channels.fetch(CHANNELS.ROLE_SELECT);
        if (!roleChannel) return;

        const messages = await roleChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🔔 Pick Your Notification Roles')
            .setDescription('Select which tip rain events you want to be pinged for:')
            .addFields(
                { name: '💎 DonutDrop', value: 'Get pinged when a tip rain starts on DonutDrop.', inline: false },
                { name: '⚡ DonutSurge', value: 'Get pinged when a tip rain starts on DonutSurge.', inline: false },
                { name: '🌧️ DonutStake', value: 'Get pinged when a tip rain starts on DonutStake.', inline: false }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('role_donutdrop')
                .setLabel('DonutDrop')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💎'),
            new ButtonBuilder()
                .setCustomId('role_donutsurge')
                .setLabel('DonutSurge')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚡'),
            new ButtonBuilder()
                .setCustomId('role_donutstake')
                .setLabel('DonutStake')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🌧️')
        );

        if (existingPanel) {
            await existingPanel.edit({ embeds: [embed], components: [row] });
        } else {
            await roleChannel.send({ embeds: [embed], components: [row] });
        }
    } catch (err) {
        console.error('Failed to setup role select panel:', err.message);
    }
}

async function sendTicketPanel() {
    try {
        const ticketChannel = await client.channels.fetch(CHANNELS.TICKET_PANEL);
        if (!ticketChannel) return;

        const messages = await ticketChannel.messages.fetch({ limit: 10 });
        const existingPanel = messages.find(m => m.author.id === client.user.id && m.components.length > 0);

        const embed = new EmbedBuilder()
            .setColor(0x00AE86)
            .setTitle('🎫 **Ticket System - Help & Giveaway**')
            .setDescription('Need help, have a **question/suggestion regarding Rain**, or want to resolve something related to a **Giveaway**?\n\nClick the appropriate button below to open a private ticket!')
            .addFields(
                { name: '🌧️ Rain Ticket', value: 'Questions, suggestions, or reports regarding Rain features.', inline: false },
                { name: '🎉 Giveaway Ticket', value: 'Matters regarding giveaway rewards and claims.', inline: false }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket_rain')
                .setLabel('Ticket: Rain (Questions/Suggestions)')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🌧️'),
            new ButtonBuilder()
                .setCustomId('create_ticket_giveaway')
                .setLabel('Ticket: Giveaway')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎉')
        );

        if (existingPanel) {
            await existingPanel.edit({ embeds: [embed], components: [row] });
        } else {
            await ticketChannel.send({ embeds: [embed], components: [row] });
        }
    } catch (err) {
        console.error('Failed to setup ticket panel:', err.message);
    }
}

client.once('clientReady', async () => {
    console.log(`Multi-Platform Rain Monitor: Wiktor is ready`);
    
    await sendRoleSelectPanel();
    await sendTicketPanel();

    const CHECK_INTERVAL = 10000;
    
    runCheck(DONUTDROP_CONFIG, CHANNELS.DONUTDROP_ALERT, 'DonutDrop', 'donutdrop');
    runCheck(DONUTDSURGE_CONFIG, CHANNELS.DONUTDSURGE_ALERT, 'Donutsurge', 'donutsurge');
    runCheck(DONUTSTAKE_CONFIG, CHANNELS.DONUTSTAKE_ALERT, 'Donutstake', 'donutstake');

    setInterval(() => runCheck(DONUTDROP_CONFIG, CHANNELS.DONUTDROP_ALERT, 'DonutDrop', 'donutdrop'), CHECK_INTERVAL);
    setInterval(() => runCheck(DONUTDSURGE_CONFIG, CHANNELS.DONUTDSURGE_ALERT, 'Donutsurge', 'donutsurge'), CHECK_INTERVAL);
    setInterval(() => runCheck(DONUTSTAKE_CONFIG, CHANNELS.DONUTSTAKE_ALERT, 'Donutstake', 'donutstake'), CHECK_INTERVAL);
});

async function runCheck(config, channelId, platformName, key) {
    try {
        const response = await axios.get(config.url, { headers: config.headers, timeout: 5000 });
        const data = response.data;
        
        let isRainActive = false;
        let newMsgText = '';

        if (key === 'donutsurge') {
            isRainActive = (data.open && data.open.id) || (data.pot && data.pot > 0) || (data.rain && data.rain.active);
            if (isRainActive) newMsgText = formatDonutsurgeData(data);
        } else if (key === 'donutstake') {
            isRainActive = (data.active === true) || (data.poolAmount && data.poolAmount > 0) || (data.rainActive === true);
            if (isRainActive) newMsgText = formatDonutstakeData(data);
        } else {
            const rainObj = data.rain || data;
            isRainActive = data.enabled || rainObj?.active || rainObj?.phase === 'RAINING' || rainObj?.status === 'RAINING' || data.status === 'active' || (rainObj?.potRaw && rainObj.potRaw > 0) || (rainObj?.pool && rainObj.pool > 0) || (rainObj?.pot && rainObj.pot > 0);
            if (isRainActive) newMsgText = formatStandardRainData(rainObj, data, platformName, ROLES.DONUTDROP_PING);
        }

        const channel = await client.channels.fetch(channelId);
        if (!channel) return;

        const now = Date.now();
        const THIRTY_MINUTES = 30 * 60 * 1000;
        const timeElapsedSinceRefresh = now - lastRefreshTimestamp[key];

        if (!isRainActive) {
            if (activeRainMessageIds[key]) {
                try {
                    const oldMsg = await channel.messages.fetch(activeRainMessageIds[key]);
                    if (oldMsg) await oldMsg.delete();
                } catch (e) {}
                activeRainMessageIds[key] = null;
            }
            lastRefreshTimestamp[key] = 0;
            return;
        }

        if (!activeRainMessageIds[key] || timeElapsedSinceRefresh >= THIRTY_MINUTES) {
            if (activeRainMessageIds[key]) {
                try {
                    const oldMsg = await channel.messages.fetch(activeRainMessageIds[key]);
                    if (oldMsg) await oldMsg.delete();
                } catch (e) {}
            }

            const newMsg = await channel.send(newMsgText);
            activeRainMessageIds[key] = newMsg.id;
            lastRefreshTimestamp[key] = now;
        } else {
            try {
                const existingMsg = await channel.messages.fetch(activeRainMessageIds[key]);
                if (existingMsg) {
                    await existingMsg.edit(newMsgText);
                } else {
                    const newMsg = await channel.send(newMsgText);
                    activeRainMessageIds[key] = newMsg.id;
                }
            } catch (e) {
                const newMsg = await channel.send(newMsgText);
                activeRainMessageIds[key] = newMsg.id;
            }
        }
    } catch (err) {}
}

function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([dhms])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'm': return value * 60 * 1000;
        case 's': return value * 1000;
        default: return null;
    }
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket_rain' || interaction.customId === 'create_ticket_giveaway') {
            const ticketType = interaction.customId === 'create_ticket_rain' ? 'rain' : 'giveaway';
            const guild = interaction.guild;
            const user = interaction.user;

            try {
                const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${ticketType}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
                if (existingChannel) {
                    return await interaction.reply({ content: `❌ You already have an open ticket: <#${existingChannel.id}>`, flags: 64 });
                }

                await interaction.deferReply({ flags: 64 });

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${ticketType}-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: CATEGORIES.TICKET_CATEGORY,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels]
                        }
                    ]
                });

                const embed = new EmbedBuilder()
                    .setColor(ticketType === 'rain' ? 0x0099FF : 0x57F287)
                    .setTitle(`🎫 Ticket: ${ticketType === 'rain' ? 'Rain (Questions / Suggestions)' : 'Giveaway'}`)
                    .setDescription(`Welcome <@${user.id}>!\nPlease describe your issue, question, or suggestion in detail. Staff will be with you shortly.\n\nClick the button below to close this ticket.`);

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

                await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [closeRow] });
                await interaction.editReply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>` });

            } catch (err) {
                console.error('Error creating ticket:', err);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '❌ An error occurred while creating the ticket.' });
                }
            }
            return;
        }

        if (interaction.customId === 'close_ticket') {
            try {
                await interaction.reply({ content: '🔒 Closing ticket in 3 seconds...' });
                setTimeout(async () => {
                    try {
                        await interaction.channel.delete();
                    } catch (e) {}
                }, 3000);
            } catch (err) {}
            return;
        }

        if (interaction.customId.startsWith('join_giveaway_')) {
            const giveawayId = interaction.customId.replace('join_giveaway_', '');
            const giveaway = activeGiveaways.get(giveawayId);

            if (!giveaway) {
                return await interaction.reply({ content: '❌ This giveaway has already ended or does not exist.', flags: 64 });
            }

            if (giveaway.participants.has(interaction.user.id)) {
                giveaway.participants.delete(interaction.user.id);
                await interaction.reply({ content: '🔴 You have left this giveaway.', flags: 64 });
            } else {
                giveaway.participants.add(interaction.user.id);
                await interaction.reply({ content: '🟢 Successfully joined the giveaway! Good luck!', flags: 64 });
            }

            try {
                const channel = await client.channels.fetch(giveaway.channelId);
                const msg = await channel.messages.fetch(giveaway.messageId);
                
                const updatedEmbed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('🎉 ══════════════════ 🎉\n       GIVEAWAY\n🎉 ══════════════════ 🎉')
                    .setDescription(
                        `> 🎁 **Prize:** \`${giveaway.prize}\`\n` +
                        `> 👥 **Participants:** \`${giveaway.participants.size}\`\n` +
                        `> ⏰ **Ends:** <t:${Math.floor(giveaway.endsAt / 1000)}:R>\n\n` +
                        `*Click the button below to secure your entry and win amazing rewards!*`
                    )
                    .addFields(
                        { name: '📌 Rules / Info', value: '• Click **Join Giveaway** to participate.\n• Click again to leave if you change your mind.', inline: false }
                    )
                    .setFooter({ text: `Hosted by ${giveaway.hostTag}` });

                await msg.edit({ embeds: [updatedEmbed] });
            } catch (e) {}
            return;
        }

        const roleMap = {
            'role_donutdrop': ROLES.DONUTDROP_PING,
            'role_donutsurge': ROLES.DONUTSURGE_PING,
            'role_donutstake': ROLES.DONUTSTAKE_PING
        };

        const targetRoleId = roleMap[interaction.customId];
        if (!targetRoleId) return;

        try {
            const member = interaction.member;
            const role = interaction.guild.roles.cache.get(targetRoleId);

            if (!role) {
                return await interaction.reply({ content: '❌ Target role does not exist on this server.', flags: 64 });
            }

            if (member.roles.cache.has(targetRoleId)) {
                await member.roles.remove(role);
                await interaction.reply({ content: `🔴 Removed the **${role.name}** role.`, flags: 64 });
            } else {
                await member.roles.add(role);
                await interaction.reply({ content: `🟢 Added the **${role.name}** role!`, flags: 64 });
            }
        } catch (err) {
            console.error('Error toggling role:', err.message);
            if (!interaction.replied) {
                await interaction.reply({ content: '❌ Failed to update role permissions.', flags: 64 });
            }
        }
    }
});

client.on('guildMemberAdd', async (member) => {
    try {
        await member.roles.add(ROLES.AUTO_ROLE);
        console.log(`[AUTO-ROLE] Successfully assigned role to new member: ${member.user.tag}`);
    } catch (err) {
        console.error(`[AUTO-ROLE ERROR] Could not assign role to ${member.user.tag}:`, err.message);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.id === client.user.id) return;
    const content = message.content.trim();
    const lowerContent = content.toLowerCase();

    if (lowerContent === '!lock') {
        try {
            await message.delete();
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: false
            });
            const lockMsg = await message.channel.send(`🔒 **Channel has been locked.** No one can type here.`);
            setTimeout(async () => { try { await lockMsg.delete(); } catch (e) {} }, 10000);
        } catch (err) {
            console.error('Error locking channel:', err.message);
        }
        return;
    }

    if (lowerContent.startsWith('!purge')) {
        try {
            if (!message.member.permissions.has('ManageMessages')) {
                const reply = await message.channel.send('❌ You do not have permissions to manage messages (`ManageMessages`).');
                setTimeout(async () => { try { await reply.delete(); } catch (e) {} }, 5000);
                return;
            }

            const args = content.split(/\s+/);
            const target = args[1]?.toLowerCase();

            if (!target) {
                const reply = await message.channel.send('⚠️ Usage: `!purge [1-100]` or `!purge all`.');
                setTimeout(async () => { try { await reply.delete(); } catch (e) {} }, 5000);
                return;
            }

            if (target === 'all') {
                await message.delete().catch(() => {});
                let totalDeleted = 0;
                let fetched;

                do {
                    fetched = await message.channel.messages.fetch({ limit: 100 });
                    if (fetched.size > 0) {
                        const deleted = await message.channel.bulkDelete(fetched, true);
                        totalDeleted += deleted.size;
                    }
                } while (fetched.size >= 2);

                const successMsg = await message.channel.send(`🧹 Successfully deleted **${totalDeleted}** messages.`);
                setTimeout(async () => { try { await successMsg.delete(); } catch (e) {} }, 4000);
                return;
            }

            const deleteCount = parseInt(target);

            if (isNaN(deleteCount) || deleteCount < 1 || deleteCount > 100) {
                const reply = await message.channel.send('⚠️ Please provide a valid message count between **1 and 100** or type `!purge all`.');
                setTimeout(async () => { try { await reply.delete(); } catch (e) {} }, 5000);
                return;
            }

            await message.channel.bulkDelete(deleteCount + 1, true);
            const successMsg = await message.channel.send(`🧹 Successfully deleted **${deleteCount}** messages.`);
            setTimeout(async () => { try { await successMsg.delete(); } catch (e) {} }, 4000);

        } catch (err) {
            console.error('Error during purge:', err.message);
            const errReply = await message.channel.send('❌ An error occurred while deleting messages.');
            setTimeout(async () => { try { await errReply.delete(); } catch (e) {} }, 5000);
        }
        return;
    }

    if (lowerContent.startsWith('!giveaway')) {
        try {
            if (!message.member.permissions.has('Administrator')) {
                const reply = await message.channel.send('❌ You do not have administrator permissions to create giveaways.');
                setTimeout(async () => { try { await reply.delete(); } catch (e) {} }, 5000);
                return;
            }

            const args = content.split(/\s+/);
            if (args.length < 3) {
                const reply = await message.channel.send('⚠️ Usage: `!giveaway [duration] [prize] (@user)` (e.g. `!giveaway 1d 100m`).');
                setTimeout(async () => { try { await reply.delete(); } catch (e) {} }, 5000);
                return;
            }

            const durationMs = parseDuration(args[1]);
            if (!durationMs) {
                const reply = await message.channel.send('⚠️ Invalid time format! Use e.g. `1d` (days), `2h` (hours), `30m` (minutes), `30s` (seconds).');
                setTimeout(async () => { try { await reply.delete(); } catch (e) {} }, 5000);
                return;
            }

            const forcedWinnerMention = message.mentions.users.first();
            const forcedWinnerId = forcedWinnerMention ? forcedWinnerMention.id : null;

            let prize = args.slice(2).join(' ');
            if (forcedWinnerMention) {
                prize = prize.replace(new RegExp(`<@!?${forcedWinnerId}>`, 'g'), '').trim();
            }

            await message.delete().catch(() => {});

            const giveawayId = Date.now().toString();
            const participants = new Set();
            const endsAt = Date.now() + durationMs;

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🎉 ══════════════════ 🎉\n       GIVEAWAY\n🎉 ══════════════════ 🎉')
                .setDescription(`> 🎁 **Prize:** \`${prize}\`\n> 👥 **Participants:** \`0\`\n> ⏰ **Ends:** <t:${Math.floor(endsAt / 1000)}:R>\n\n*Click the button below to secure your entry and win amazing rewards!*`)
                .addFields(
                    { name: '📌 Rules / Info', value: '• Click **Join Giveaway** to participate.\n• Click again to leave if you change your mind.', inline: false }
                )
                .setFooter({ text: `Hosted by ${message.author.tag}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`join_giveaway_${giveawayId}`)
                    .setLabel('Join Giveaway')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎁')
            );

            const giveawayMsg = await message.channel.send({ content: '@everyone', embeds: [embed], components: [row] });

            activeGiveaways.set(giveawayId, { 
                participants, 
                prize, 
                channelId: message.channel.id, 
                messageId: giveawayMsg.id, 
                endsAt, 
                hostTag: message.author.tag 
            });

            setTimeout(async () => {
                activeGiveaways.delete(giveawayId);

                try {
                    const fetchedMsg = await message.channel.messages.fetch(giveawayMsg.id).catch(() => null);
                    if (!fetchedMsg) return;

                    let winnerId = forcedWinnerId;

                    if (!winnerId) {
                        if (participants.size === 0) {
                            const endedEmbed = new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle('🎉 ══════════════════ 🎉\n     GIVEAWAY ENDED\n🎉 ══════════════════ 🎉')
                                .setDescription(`> 🎁 **Prize:** \`${prize}\`\n> 👥 **Total Participants:** \`0\`\n\n❌ **No participants – no winner selected.**`);
                            return await fetchedMsg.edit({ content: '', embeds: [endedEmbed], components: [] });
                        }

                        const participantsArray = Array.from(participants);
                        winnerId = participantsArray[Math.floor(Math.random() * participantsArray.length)];
                    }

                    const winnerUser = await message.guild.members.fetch(winnerId).catch(() => null);

                    const endedEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle('🎉 ══════════════════ 🎉\n     GIVEAWAY ENDED\n🎉 ══════════════════ 🎉')
                        .setDescription(`> 🎁 **Prize:** \`${prize}\`\n> 👥 **Total Participants:** \`${participants.size}\`\n\n🏆 **Winner:** <@${winnerId}>`);

                    await fetchedMsg.edit({ content: '', embeds: [endedEmbed], components: [] });
                    
                    await message.channel.send(`YOU WON <@${winnerId}> CONGRATULATIONS MAKE A TICKET IN https://discord.com/channels/1554592547093876847/1566427140138868786`);

                    if (winnerUser) {
                        const roleToAssign = message.guild.roles.cache.get(ROLES.GIVEAWAY_WINNER);
                        if (roleToAssign) {
                            await winnerUser.roles.add(roleToAssign).catch(err => console.error('Failed to assign winner role:', err));
                        }
                    }

                } catch (err) {
                    console.error('Error ending giveaway:', err);
                }
            }, durationMs);

        } catch (err) {
            console.error('Giveaway command error:', err);
        }
        return;
    }
});

client.login(TOKEN);
