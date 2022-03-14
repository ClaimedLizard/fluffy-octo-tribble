// Require the necessary discord.js classes
const fs = require('fs');
const { Collection } = require('discord.js');

// Create a new client instance and login to discord
// Import method that determines if user is authorized to command this bot
const { client, isLegal } = require('./client.js');

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
