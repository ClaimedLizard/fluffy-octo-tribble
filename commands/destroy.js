const { SlashCommandBuilder } = require('@discordjs/builders');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('destroy')
        .setDescription('Destroy the current voice connection.'),
    async execute(interaction) {
        const connection = getVoiceConnection(interaction.guildId);
        if (connection == null) {
            await interaction.reply({ content: 'No current voice connection.', ephemeral: true });
        }
        else {
            connection.destroy();
            interaction.client.user.setActivity('');
            await interaction.reply({ content: ':wave:' });
        }
    },
};