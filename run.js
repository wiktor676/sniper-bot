require('dotenv').config();
const http = require('http');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionsBitField, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

// ------------------------------------------------------------------
// 1. HTTP SERVER FOR RENDER (Fixes 502 Bad Gateway & UptimeRobot)
// ------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('DonutSMP Sniper Bot is active and running 24/7!\n');
});

server.listen(PORT, () => {
  console.log(`[SYS] HTTP Keep-Alive Server listening on port ${PORT}`);
});

// ------------------------------------------------------------------
// 2. DISCORD CLIENT CONFIGURATION
// ------------------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.once('ready', () => {
  console.log(`[BOT] Logged in successfully as ${client.user.tag}`);
  client.user.setActivity('DonutSMP Giveaways & Drops', { type: 3 });
});

// ------------------------------------------------------------------
// 3. AUTOMATED GIVEAWAY SYSTEM
// ------------------------------------------------------------------
async function startGiveaway(channel, prize, durationMinutes) {
  const embed = new EmbedBuilder()
    .setTitle('🎉 DONUTSMP GIVEAWAY 🎉')
    .setDescription(
      `**Prize:** ${prize}\n\n` +
      `React with 🎉 to enter!\n` +
      `Duration: **${durationMinutes} minute(s)**\n` +
      `Hosted by: Community Team`
    )
    .setColor(0x00AEFF)
    .setTimestamp()
    .setFooter({ text: 'DonutSMP Community Giveaways' });

  const giveawayMessage = await channel.send({
    content: '@everyone 🎉 **NEW GIVEAWAY STARTED!**',
    embeds: [embed]
  });

  await giveawayMessage.react('🎉');

  // Timer for giveaway ending
  setTimeout(async () => {
    try {
      const fetchedMsg = await channel.messages.fetch(giveawayMessage.id);
      const reaction = fetchedMsg.reactions.cache.get('🎉');

      if (!reaction) {
        await channel.send('🎉 Giveaway ended, but no reactions were found.');
        return;
      }

      const users = await reaction.users.fetch();
      const validEntrants = Array.from(users.values()).filter((user) => !user.bot);

      if (validEntrants.length === 0) {
        const noWinnerEmbed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Ended')
          .setDescription(`**Prize:** ${prize}\n\n**Winner:** No valid entries.`)
          .setColor(0xFF0000)
          .setTimestamp();

        await channel.send({ content: '@everyone', embeds: [noWinnerEmbed] });
        return;
      }

      // Pick random winner
      const winnerUser = validEntrants[Math.floor(Math.random() * validEntrants.length)];

      const winnerEmbed = new EmbedBuilder()
        .setTitle('🎉 GIVEAWAY WINNER ANNOUNCEMENT 🎉')
        .setDescription(
          `**Prize:** ${prize}\n` +
          `**Winner:** <@${winnerUser.id}> (${winnerUser.username})\n\n` +
          `Congratulations **${winnerUser.username}**! Please open a ticket in <#TICKETS> to claim your reward.`
        )
        .setColor(0x00FF00)
        .setFooter({ text: 'DonutSMP Community Giveaways' })
        .setTimestamp();

      // Public announcement to everyone with username ping
      await channel.send({
        content: `@everyone 🎉 **Congratulations to ${winnerUser.username} for winning the giveaway!**`,
        embeds: [winnerEmbed]
      });
    } catch (error) {
      console.error('[ERROR] Failed to end giveaway:', error);
    }
  }, durationMinutes * 60 * 1000);
}

// ------------------------------------------------------------------
// 4. BUTTON ROLE INTERACTION HANDLER
// ------------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('role_')) {
    const roleId = interaction.customId.replace('role_', '');
    const role = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      return interaction.reply({ content: 'Role not found on this server!', ephemeral: true });
    }

    const member = interaction.member;
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      await interaction.reply({ content: `Removed the **${role.name}** role!`, ephemeral: true });
    } else {
      await member.roles.add(role);
      await interaction.reply({ content: `Added the **${role.name}** role!`, ephemeral: true });
    }
  }
});

// ------------------------------------------------------------------
// 5. COMMAND HANDLER
// ------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Command: !gstart <minutes> <prize>
  if (message.content.startsWith('!gstart')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('You do not have permission to start giveaways!');
    }

    const args = message.content.slice(7).trim().split(' ');
    const duration = parseInt(args[0]);
    const prize = args.slice(1).join(' ');

    if (isNaN(duration) || !prize) {
      return message.reply('Usage: `!gstart <minutes> <prize>` (Example: `!gstart 1 10M Cash`)');
    }

    await message.delete().catch(() => {});
    startGiveaway(message.channel, prize, duration);
  }

  // Command: !addrole @Role / !addrole RoleID (Creates a reaction button panel for roles)
  if (message.content.startsWith('!addrole')) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply('You do not have permission to setup reaction roles!');
    }

    const role = message.mentions.roles.first() || message.guild.roles.cache.get(message.content.split(' ')[1]);

    if (!role) {
      return message.reply('Usage: `!addrole @RoleName`');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(`Get ${role.name} Role`)
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🎭 Self-Assignable Roles')
      .setDescription(`Click the button below to get or remove the **${role.name}** role!`)
      .setColor(role.color || 0x00FF00);

    await message.channel.send({ embeds: [embed], components: [row] });
  }

  // Command: !help
  if (message.content === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🤖 DonutSMP Bot Commands')
      .setColor(0x00AEFF)
      .addFields(
        { name: '🎉 `!gstart <mins> <prize>`', value: 'Starts a giveaway with public winner ping' },
        { name: '🎭 `!addrole @Role`', value: 'Creates a button for users to claim a role' }
      );

    await message.channel.send({ embeds: [helpEmbed] });
  }
});

// ------------------------------------------------------------------
// 6. BOT LOGIN
// ------------------------------------------------------------------
client.login(process.env.DISCORD_TOKEN);
