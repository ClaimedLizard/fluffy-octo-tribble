const { SlashCommandBuilder } = require ('@discordjs/builders');
const { player } = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause current playback.'),
    async execute(interaction) {
        player.pause();
        await interaction.reply({ content: 'Playback paused.' });
    },
};