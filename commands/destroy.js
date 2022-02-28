const { SlashCommandBuilder } = require('@discordjs/builders');
const { getVoiceConnection } = require('@discordjs/voice');
const play = require('./play.js');
const { saveGuildToChannel } = require('../client.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('destroy')
        .setDescription('Destroy the current voice connection.'),
    async execute(interaction) {
        // If there has been a change in the guildToChannel map, write the changes to a new file now
        saveGuildToChannel();

        const connection = getVoiceConnection(interaction.guildId);
        if (connection == null) {
            await interaction.reply({ content: 'No current voice connection.', ephemeral: true });
        }
        else {
            connection.destroy();
            play.player.emit('skip'); // Mark the currently playing song as skipped
            interaction.client.user.setActivity('');
            play.botChannel = null;
            await interaction.reply({ content: ':wave:' });
        }
    },
};
