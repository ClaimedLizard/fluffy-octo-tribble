const { SlashCommandBuilder } = require ('@discordjs/builders');
const { player } = require('./play.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume music playback if paused.'),
    async execute(interaction) {
        if (player.state.status == AudioPlayerStatus.Paused) {
            player.unpause();
            await interaction.reply({ content: 'Player unpaused.' });
        }
        else {
            await interaction.reply({ content: 'Player is not paused!' });
        }
    },
};