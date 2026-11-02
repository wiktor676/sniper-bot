require('dotenv').config();
const http = require('http');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// ------------------------------------------------------------------
// 1. HTTP SERVER FOR RENDER (Fixes 502 Bad Gateway & UptimeRobot)
// ------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is active and running 24/7!\n');
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
});

// ------------------------------------------------------------------
// 3. PUBLIC GIVEAWAY SYSTEM (Announces Winner Publicly)
// ------------------------------------------------------------------
/**
 * Function to end a giveaway and publicly announce the winner
 * @param {TextChannel} channel - The public channel where the giveaway was posted
 * @param {string} prize - Name of the prize (e.g., "$10,000,000 DonutSMP Cash")
 * @param {Array<User>} participants - Array of Discord Users who entered
 */
async function endGiveaway(channel, prize, participants) {
  if (!participants || participants.length === 0) {
    const noWinnerEmbed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Ended')
      .setDescription(`**Prize:** ${prize}\n\n**Winner:** No valid entries. The giveaway has ended without a winner.`)
      .setColor(0xFF0000)
      .setTimestamp();

    await channel.send({ content: '@everyone', embeds: [noWinnerEmbed] });
    return;
  }

  // Pick a random winner from participants
  const winnerUser = participants[Math.floor(Math.random() * participants.length)];

  // Public Announcement Embed
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

  // Send public message with @everyone ping announcing the user's Discord name to everyone
  await channel.send({
    content: `@everyone 🎉 **Congratulations to ${winnerUser.username} for winning the giveaway!**`,
    embeds: [winnerEmbed]
  });
}

// ------------------------------------------------------------------
// 4. COMMAND / MESSAGE LISTENER
// ------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Example test command: !testgiveaway
  if (message.content === '!testgiveaway') {
    // Example test run: announcing the message author as winner publicly
    await endGiveaway(message.channel, '1,000,000 DonutSMP Cash', [message.author]);
  }
});

// ------------------------------------------------------------------
// 5. BOT LOGIN USING ENVIRONMENT VARIABLE
// ------------------------------------------------------------------
client.login(process.env.DISCORD_TOKEN);
