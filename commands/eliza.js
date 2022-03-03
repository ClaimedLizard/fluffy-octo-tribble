const { SlashCommandBuilder } = require ('@discordjs/builders');
const { client, isLegal } = require('../client.js');
const Eliza = require('../eliza-as-promised');
const eliza = new Eliza();
const goodWords = ['I agree', 'You\'re the best', 'Wise words', 'You\'re so smart', 'Nice', 'Absolutely', 'Definitely', 'Exactly', 'You\'re right', 'I couldn\'t agree more', 'That\'s true', 'That\'s for sure'];
// If the doctor is in, then reply with eliza responses
// If false, then reply with agreement messages
let theDoctorIsIn = false;

// Robocop
client.on('messageCreate', (message) => {
    // Express solidarity with other bots
    if (message.author.bot && message.author.id != message.guild.me.id) {
        message.react('🤖');
    }
    // If the doctor is in, then reply with eliza
    if (theDoctorIsIn && message.author.id != message.guild.me.id) {
        const statement = message.content;
        eliza.getResponse(statement).then(async (response) => {
            if (response.reply) {
                message.channel.send(response.reply);
            }
            else if (response.final) {
                message.channel.send(response.final);
                // Turn the doctor off
                theDoctorIsIn = false;
            }
        });
    }
    // Agree with wise words from wise men
    else if (isLegal(message.member)) {
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
        .setDescription('Call the doctor'),
    async execute(interaction) {
        // Toggle the doctor on or off
        theDoctorIsIn = !theDoctorIsIn;
        if (theDoctorIsIn) {
            await interaction.reply({ content:eliza.getInitial() });
        }
        else {
            eliza.getResponse('Bye').then(async (response) => {
                await interaction.reply({ content:response.final });
            });
        }
    },
};
