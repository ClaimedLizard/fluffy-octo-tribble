const { SlashCommandBuilder } = require ('@discordjs/builders');
const { setChannel } = require('../client.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('bind-channel')
        .setDescription('Bind this bot to the given channelId')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID of channel to bind bot')
                .setRequired(true)),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const channelId = interaction.options.getString('id');

        // Exit early on a malformed ID
        if (!channelId.match(/^[\d]{17,}$/)) {
            await interaction.reply({ content: 'Malformed channel ID', ephemeral: true });
            return;
        }

        // Check that the given channel exists in this guild
        await interaction.guild.channels.fetch(channelId).then(async (channel) => {
            setChannel(guildId, channelId);
            await interaction.reply({ content: `Bot has been bound to channel \`${channel.name}\``, ephemeral: true });
        }).catch(async () => {
            await interaction.reply({ content: 'No such channel in this guild', ephemeral: true });
            return;
        });
    },
};
