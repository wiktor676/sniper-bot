require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const PREFIX = '!';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}! Bot is active and monitoring.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Giveaway Command: !giveaway [durationInSeconds] [prize] [@forcedUser (optional)]
    if (command === 'giveaway') {
        if (args.length < 2) {
            return message.reply('Usage: `!giveaway [duration_in_seconds] [prize] [@optional_winner]`');
        }

        const durationSec = parseInt(args[0]);
        const forcedUserIndex = args.findIndex(arg => arg.startsWith('<@') && arg.endsWith('>'));
        
        let prize = '';
        let forcedUser = null;

        if (forcedUserIndex !== -1) {
            forcedUser = message.mentions.users.first();
            prize = args.slice(1, forcedUserIndex).join(' ');
        } else {
            prize = args.slice(1).join(' ');
        }

        if (isNaN(durationSec) || durationSec <= 0) {
            return message.reply('Please provide a valid duration in seconds.');
        }

        const giveawayMsg = await message.channel.send(`🎉 **GIVEAWAY** 🎉\nPrize: **${prize}**\nReact with 🎉 to enter!\nEnds in: ${durationSec} seconds.`);
        await giveawayMsg.react('🎉');

        const filter = (reaction, user) => reaction.emoji.name === '🎉' && !user.bot;
        const collector = giveawayMsg.createReactionCollector({ filter, time: durationSec * 1000 });

        collector.on('end', async () => {
            const reaction = giveawayMsg.reactions.cache.get('🎉');
            let winner = null;

            if (forcedUser) {
                winner = forcedUser;
                await giveawayMsg.channel.send(`🎉 **GIVEAWAY ENDED** 🎉\nWinner (Forced): ${winner}! Congratulations on winning **${prize}**!`);
                return;
            }

            if (reaction) {
                const users = await reaction.users.fetch();
                const validUsers = users.filter(user => !user.bot);

                if (validUsers.size > 0) {
                    const winnerArray = Array.from(validUsers.values());
                    winner = winnerArray[Math.floor(Math.random() * winnerArray.length)];
                    await giveawayMsg.channel.send(`🎉 **GIVEAWAY ENDED** 🎉\nWinner: ${winner}! Congratulations on winning **${prize}**!`);
                } else {
                    await giveawayMsg.channel.send(`🎉 **GIVEAWAY ENDED** 🎉\nNo valid entries recorded for **${prize}**.`);
                }
            } else {
                await giveawayMsg.channel.send(`🎉 **GIVEAWAY ENDED** 🎉\nNo reactions found for **${prize}**.`);
            }
        });
    }
});

client.login(TOKEN);
