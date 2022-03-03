// Require the necessary discord.js classes
const fs = require('fs');
const { Collection } = require('discord.js');
const { authorizedRoleId, masterId } = require('./config.json'); // This bot only listens to users with a role matching the defined id
const goodWords = ['I agree', 'You\'re the best', 'Wise words', 'You\'re so smart', 'Nice', 'Absolutely', 'Definitely', 'Exactly', 'You\'re right', 'I couldn\'t agree more', 'That\'s true', 'That\'s for sure'];

// Create a new client instance and login to discord
const { client } = require('./client.js');

// Event Handling
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    }
    else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Command Handling
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    // Set a new item in the Collection
    // With the key as the command name and the value as the exported module
    client.commands.set(command.data.name, command);
}

// Define method that determines if a user is authorized to command this bot
const isLegal = (guildMember) => {
    return guildMember.roles.cache.has(authorizedRoleId) || guildMember.id == masterId;
};

// Define replies to commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // Only authorized users can command the bot
    if (!isLegal(interaction.member)) {
        await interaction.reply({ content:'Go away' });
        return;
    }

    const command = client.commands.get(interaction.commandName);

    // Exit early on undefined command
    if (!command) return;

    try {
        await command.execute(interaction);
    }
    catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Robocop
client.on('messageCreate', (message) => {
    // Express solidarity with other bots
    if (message.author.bot && message.author.id != message.guild.me.id) {
        message.react('🤖');
    }
    // Agree with wise words from wise men
    if (isLegal(message.member) || message.author.id == masterId) {
        const index = Math.floor(Math.random() * goodWords.length);
        message.channel.send(goodWords[index]).then((m1) => {
            setTimeout((m2) => {
                m2.delete().catch((err) => {
                    console.log('Could not delete agreement message');
                    console.log(err);
                });
            }, 5000, m1);
        });
    }
});
