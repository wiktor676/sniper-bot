const axios = require('axios');
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder 
} = require('discord.js');
const http = require('http');

// Prosty serwer HTTP utrzymujący bota przy życiu na Render / UptimeRobot
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Tip Rain Monitor Bot is running 24/7!\n');
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
    DONUTDROP_ALERT: '1567279946798203041',
    PLAYDONUT_ALERT: '1566893420134531072',
    DONUTDSURGE_ALERT: '1567279970148032582',
    ROLE_SELECT: '1565826447833170122'
};

const ROLES = {
    DONUTDROP_PING: '1565836541597851748',
    PLAYDONUT_PING: '1565836174394658856',
    DONUTSURGE_PING: '1565836388128133342'
};

const DONUTDROP_CONFIG = {
    url: 'https://donutdrop.net/api/rain',
    headers: {
        'Accept': '*/*',
        'Cookie': 'connect.sid=s%3AAv3jegRdlp2qM8hNWN1pQB4oEXemk_W5.K%2BuJ9jaj2FeIOcUCbSLgfl2mwNy98XMOuZGRIYaITFs; dd_dev=4a-Hedj5R1ZJFp4K9JP9qLmH',
        'Referer': 'https://donutdrop.net/account/fairness',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0'
    }
};

const PLAYDONUT_CONFIG = {
    url: 'https://playdonut.gg/api/rain',
    headers: {
        'Accept': '*/*',
        'Cookie': 'vid=cd9f9853-097d-4659-b1bb-7e896fb75e53; sid=8cbcea10-cb3b-44fd-8f4b-47f000d62234',
        'Referer': 'https://playdonut.gg/',
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

const activeRainMessageIds = { donutdrop: null, playdonut: null, donutsurge: null };
const lastRefreshTimestamp = { donutdrop: 0, playdonut: 0, donutsurge: 0 };

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
                { name: '🍩 PlayDonut', value: 'Get pinged when a tip rain starts on PlayDonut.', inline: false },
                { name: '⚡ DonutSurge', value: 'Get pinged when a tip rain starts on DonutSurge.', inline: false }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('role_donutdrop')
                .setLabel('DonutDrop')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💎'),
            new ButtonBuilder()
                .setCustomId('role_playdonut')
                .setLabel('PlayDonut')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🍩'),
            new ButtonBuilder()
                .setCustomId('role_donutsurge')
                .setLabel('DonutSurge')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚡')
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

client.once('clientReady', async () => {
    console.log(`Multi-Platform Rain Monitor: Wiktor is ready`);
    
    await sendRoleSelectPanel();

    const CHECK_INTERVAL = 10 * 1000;
    
    runCheck(DONUTDROP_CONFIG, CHANNELS.DONUTDROP_ALERT, 'DonutDrop', 'donutdrop');
    runCheck(PLAYDONUT_CONFIG, CHANNELS.PLAYDONUT_ALERT, 'PlayDonut', 'playdonut');
    runCheck(DONUTDSURGE_CONFIG, CHANNELS.DONUTDSURGE_ALERT, 'Donutsurge', 'donutsurge');

    setInterval(() => runCheck(DONUTDROP_CONFIG, CHANNELS.DONUTDROP_ALERT, 'DonutDrop', 'donutdrop'), CHECK_INTERVAL);
    setInterval(() => runCheck(PLAYDONUT_CONFIG, CHANNELS.PLAYDONUT_ALERT, 'PlayDonut', 'playdonut'), CHECK_INTERVAL);
    setInterval(() => runCheck(DONUTDSURGE_CONFIG, CHANNELS.DONUTDSURGE_ALERT, 'Donutsurge', 'donutsurge'), CHECK_INTERVAL);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const roleMap = {
            'role_donutdrop': ROLES.DONUTDROP_PING,
            'role_playdonut': ROLES.PLAYDONUT_PING,
            'role_donutsurge': ROLES.DONUTSURGE_PING
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
        } else {
            const rainObj = data.rain || data;
            isRainActive = data.enabled || rainObj?.active || rainObj?.phase === 'RAINING' || rainObj?.status === 'RAINING' || data.status === 'active' || (rainObj?.potRaw && rainObj.potRaw > 0) || (rainObj?.pool && rainObj.pool > 0) || (rainObj?.pot && rainObj.pot > 0);
            
            let roleToPing = ROLES.DONUTDROP_PING;
            if (key === 'playdonut') roleToPing = ROLES.PLAYDONUT_PING;

            if (isRainActive) newMsgText = formatStandardRainData(rainObj, data, platformName, roleToPing);
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

client.login(process.env.DISCORD_TOKEN);
