const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('./play.js');
const { getChannel } = require('../client.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('summon')
        .setDescription('Summon the bot to the current voice channel.'),

    async execute(interaction) {
        const channelId = getChannel(interaction.guildId);

        // Check that user has already bound the bot to a channel within this guild
        if (!channelId) {
            await interaction.reply({ content:'Bind me to a channel first!', ephemeral:true });
            return;
        }

        // Tell player to post music playback messages to the proper channel
        play.botChannel = channelId;

        const connection = joinVoiceChannel({
            channelId: interaction.member.voice.channelId,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
        });
        await interaction.reply({ content :'Connected!' });

        const subscription = connection.subscribe(play.player); // Subscribe this connection to the shared player.

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

        play.player.emit(AudioPlayerStatus.Idle);
    },
};
