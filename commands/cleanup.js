const { SlashCommandBuilder } = require ('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Clears all of bot\'s own messages in this channel within the cache'),
    async execute(interaction) {
        const botMessages = interaction.channel.messages.cache.filter(message => message.author.id == message.guild.me.id);
        await botMessages.each(async (message) => {
            await message.delete().catch((err) => {
                console.log(err);
            });
        });
        await interaction.reply({ content:'Done', ephemeral:true });
    },
};
