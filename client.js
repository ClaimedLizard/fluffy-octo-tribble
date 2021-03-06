const { Client, Intents } = require('discord.js');
const token = process.env['BOT_TOKEN']; // Grab bot token from the environment
const fs = require('fs');
const { authorizedRoleId, masterId } = require('./config.json'); // This bot only listens to users with a role matching the defined id

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MESSAGES] });

// Login to discord with the bot token
client.login(token);

// This flag will be true if the data in guildToChannel json object has been changed
// and the file needs to be rewritten
let changeGuildToChannel = false;

// Build json that associates every guild id to a channel id
let data;
try {
    data = fs.readFileSync('./guildToChannel.json', 'utf8');
}
catch {
    fs.writeFileSync('./guildToChannel.json', '');
}

// Define guildToChannel[guildId] as the channelId the bot is currently bound to for this guild
let guildToChannel;
try {
    guildToChannel = JSON.parse(data);
}
catch {
    guildToChannel = {};
    changeGuildToChannel = true;
}

// Method to grab the channel id for the bot to post to from the guild id
// Returns null if there is no channel id
const getChannel = (guildId) => {
    if (guildId in guildToChannel) {
        return guildToChannel[guildId];
    }
    else {
        return null;
    }
};

// Method to map the given guild id to the given channel id
const setChannel = (guildId, channelId) => {
    guildToChannel[guildId] = channelId;
    changeGuildToChannel = true;
    return;
};

// Method to write the guildToChannel map to the disk
const saveGuildToChannel = () => {
    if (changeGuildToChannel) {
        fs.writeFileSync('./guildToChannel.json', JSON.stringify(guildToChannel));
    }
};

// Define method that determines if a user is authorized to command this bot
const isLegal = (guildMember) => {
    // Edge cases
    if (guildMember == null || guildMember.roles == null) {
        return false;
    }
    return guildMember.roles.cache.has(authorizedRoleId) || guildMember.id == masterId;
};

module.exports = {
    client: client,
    getChannel: getChannel,
    setChannel: setChannel,
    saveGuildToChannel: saveGuildToChannel,
    isLegal: isLegal,
};
