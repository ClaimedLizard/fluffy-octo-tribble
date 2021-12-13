const { SlashCommandBuilder } = require ('@discordjs/builders');
const play = require('./play.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('change-playlist')
        .setDescription('Change the playlist for default song playback.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the playlist.')
                .setRequired(true)
                .addChoice('NotNicobox', 'NotNicobox')
                .addChoice('Chinois', 'Chinois')),
    async execute(interaction) {
        play.playlist = interaction.options.getString('name');
        play.clearPlaylistQueue(); // Clear the requested playlist
        await interaction.reply({ content: `Playlist set to: \`${interaction.options.getString('name')}\``, ephemeral: true });
    },
};