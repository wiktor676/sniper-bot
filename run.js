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

// Prosty serwer HTTP do utrzymywania działania
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Multi-Platform Tip Rain Monitor is running!\n');
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
    ROLE_SELECT: '1565826447833170122'
};

const ROLES = {
    DONUTDROP_PING: '1565836541597851748',
    DONUTSURGE_PING: '1565836388128133342',
    DONUTSTAKE_PING: '1565882472607129801',
    AUTO_ROLE: '1565837276322463806'
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
    const rawPot = rainObj.potRaw || rainObj.pool || data.amount || rainObj.amount || 0;
    const pot = rawPot > 1000 ? (rawPot / 1000000).toFixed(1) + 'M Money' : rawPot + ' Money';
    
    let timeString = 'Unknown';
    let timeLeftString = '';

    const closesAtTime = rainObj.closesAt || rainObj.endsAt || data.endsIn || rainObj.expiresAt;
    if (closesAtTime) {
        const closeDate = new Date(closesAtTime);
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

client.once('clientReady', async () => {
    console.log(`Multi-Platform Rain Monitor: Wiktor is ready`);
    
    await sendRoleSelectPanel();

    const CHECK_INTERVAL = 10 * 1000;
    
    runCheck(DONUTDROP_CONFIG, CHANNELS.DONUTDROP_ALERT, 'DonutDrop', 'donutdrop');
    runCheck(DONUTDSURGE_CONFIG, CHANNELS.DONUTDSURGE_ALERT, 'Donutsurge', 'donutsurge');
    runCheck(DONUTSTAKE_CONFIG, CHANNELS.DONUTSTAKE_ALERT, 'Donutstake', 'donutstake');

    setInterval(() => runCheck(DONUTDROP_CONFIG, CHANNELS.DONUTDROP_ALERT, 'DonutDrop', 'donutdrop'), CHECK_INTERVAL);
    setInterval(() => runCheck(DONUTDSURGE_CONFIG, CHANNELS.DONUTDSURGE_ALERT, 'Donutsurge', 'donutsurge'), CHECK_INTERVAL);
    setInterval(() => runCheck(DONUTSTAKE_CONFIG, CHANNELS.DONUTSTAKE_ALERT, 'Donutstake', 'donutstake'), CHECK_INTERVAL);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

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
            await interaction.reply({ content: '❌ Failed to update your role permissions.', flags: 64 });
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
    const content = message.content.trim().toLowerCase();

    if (content === '!lock') {
        try {
            await message.delete();
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: false
            });
            const lockMsg = await message.channel.send(`🔒 **Channel has been locked.** Nobody can type here.`);
            setTimeout(async () => { try { await lockMsg.delete(); } catch (e) {} }, 10000);
        } catch (err) {
            console.error('Error locking channel:', err.message);
        }
        return;
    }

    if (content === '!rain donutstake') {
        try {
            await message.delete();

            const response = await axios.get(DONUTSTAKE_CONFIG.url, { headers: DONUTSTAKE_CONFIG.headers, timeout: 5000 });
            const data = response.data;
            const formattedText = formatDonutstakeData(data);
            
            const replyMsg = await message.channel.send(formattedText);
            setTimeout(async () => { try { await replyMsg.delete(); } catch (e) {} }, 15000);
        } catch (err) {
            const replyMsg = await message.channel.send(`⚠️ Could not reach DonutStake API right now.`);
            setTimeout(async () => { try { await replyMsg.delete(); } catch (e) {} }, 10000);
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
        } else if (key === 'donutstake') {
            isRainActive = data.status === 'active' || data.status === 'raining' || data.canJoin === true || (data.poolAmount && data.poolAmount > 0);
            if (isRainActive) newMsgText = formatDonutstakeData(data);
        } else {
            const rainObj = data.rain || data;
            isRainActive = data.enabled || rainObj?.active || rainObj?.phase === 'RAINING' || rainObj?.status === 'RAINING' || data.status === 'active' || (rainObj?.potRaw && rainObj.potRaw > 0) || (rainObj?.pool && rainObj.pool > 0);
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
client.login(process.env.DISCORD_TOKEN);