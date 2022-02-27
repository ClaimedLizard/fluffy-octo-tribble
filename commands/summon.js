const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, AudioPlayerStatus } = require('@discordjs/voice');
const { player } = require('./play.js');
const { client } = require('../client.js');

/*
const standard_input = process.stdin;

standard_input.setEncoding('utf-8');


// Echo words typed into the terminal to a discord channel
standard_input.on('data', async (data) => {
    await client.channels.cache.get('234107814086180864').send(data);
});
*/

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summon')
        .setDescription('Summon the bot to the current voice channel.'),

    async execute(interaction) {

        const connection = joinVoiceChannel({
            channelId: interaction.member.voice.channelId,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
        });
        await interaction.reply({ content :'Connected!' });

        const subscription = connection.subscribe(player); // Subscribe this connection to the shared player.

        connection.on('stateChange', (oldState, newState) => {
            console.log('\x1b[33m%s\x1b[0m', `Connection transitioned from ${oldState.status} to ${newState.status}...`);

            if (newState.status == 'destroyed') { // Unsubscribe connection from the audio player
                console.log('\x1b[32m%s\x1b[0m', 'Caught connection destroy. Unsubscribing connection.');
                subscription.unsubscribe();
            }
            if (newState.status == 'ready') {
                console.log('\x1b[32m%s\x1b[0m', 'Connection now ready to play audio!');
            }
        });

        player.emit(AudioPlayerStatus.Idle);
    },
};
