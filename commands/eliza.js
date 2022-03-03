const { SlashCommandBuilder } = require ('@discordjs/builders');
const { client, isLegal } = require('../client.js');
const Eliza = require('../eliza-as-promised');
const eliza = new Eliza();
const goodWords = ['I agree', 'You\'re the best', 'Wise words', 'You\'re so smart', 'Nice', 'Absolutely', 'Definitely', 'Exactly', 'You\'re right', 'I couldn\'t agree more', 'That\'s true', 'That\'s for sure'];

// Robocop
client.on('messageCreate', (message) => {
    // Express solidarity with other bots
    if (message.author.bot && message.author.id != message.guild.me.id) {
        message.react('🤖');
    }
    // Agree with wise words from wise men
    if (isLegal(message.member)) {
        const index = Math.floor(Math.random() * goodWords.length);
        // Send the message, and then delete it after 5 seconds
        message.channel.send(goodWords[index]).then((mes) => {
            setTimeout(() => {
                mes.delete().catch((err) => {
                    console.log('Could not delete agreement message');
                    console.log(err);
                });
            }, 5000);
        });
    }
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eliza')
        .setDescription('Call the doctor. In Progress'),
    async execute(interaction) {
        const statement = 'I need some help';
        eliza.getResponse(statement).then(async (response) => {
            if (response.reply) {
                await interaction.reply({ content:response.reply, ephemeral:true });
                return;
            }
            if (response.final) {
                await interaction.reply({ content:response.final, ephemeral:true });
                return;
            }
        }).catch(async (err) => {
            console.log(err);
            await interaction.reply({ content:'Oops', ephemeral:true });
        });
    },
};
