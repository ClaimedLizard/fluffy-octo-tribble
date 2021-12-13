const { SlashCommandBuilder } = require ('@discordjs/builders');
const { player } = require('./play.js');
// const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the playback of the current song.'),
    async execute(interaction) {
        interaction.reply({ content: 'Skipping current song...' });
        player.emit('skip');
    },
};