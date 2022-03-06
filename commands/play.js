const { SlashCommandBuilder } = require('@discordjs/builders');
const { createAudioResource, createAudioPlayer, AudioPlayerStatus, demuxProbe, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { client } = require('../client.js');
const { MessageEmbed } = require('discord.js');
const https = require('https');

const sharedPlayer = createAudioPlayer();

// The bot will post all activity messages in this channel
// This is reset to null upon disconnect
let botChannel = null;

// Initialize the list of cached songs to play
const cacheDir = path.resolve('./cache');
let songDir = path.join(cacheDir, 'Chinois');
let songNames = fs.readdirSync(songDir).filter((file) => { return file.endsWith('.opus') || file.endsWith('.webm'); });

const requestqueue = []; // Queue for individual song requests. Will take precedence over playlistqueue
let playlistqueue = []; // Queue for whole playlist requsts. Will take precedence over cached songs
// let playlistTitle; // The name of the currently playing playlist
let currRequest = ''; // Is the url string of the song request currently playing.

let index = 0; // Index of the current song playing within the locally cached default playlist
let requestflag = false; // Will be true if the current song playing is a request
let skipflag = false; // Will be true if user requested to skip the current song

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
};

const sleep = async (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

// Probe the audio stream to determine if it is Opus or not, and return the appropriate AudioResource
const probeAndCreateResource = async (readableStream) => {
    const { stream, type } = await demuxProbe(readableStream);
    return createAudioResource(stream, { inputType: type });
};

// Function to create a progress bar string out of characters
const createProgressBar = (curr, total, length) => {
    const out = [];
    const pointerIndex = Math.floor((curr / total) * length);
    for (let i = 0; i < length; i++) {
        if (i <= pointerIndex) {
            out.push('▓');
        }
        else {
            out.push('_');
        }
    }
    return out.join('');
};

// Method to grab video metadata from provided url and post it as a Now Playing message
// Returns the Now Playing message object.
// Pass in { delete:true } into options to auto delete currPlayingMessage upon completion
const playingMessage = async (url, options) => {
    return new Promise((resolve) => {
        // Child process to grab video metadata
        const vidInfo = spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${url}`, { shell: true, cwd: cacheDir });

        let currPlayingMessage; // Message displaying the currently playing song
        const buildVidInfo = []; // Array to be joined into a JSON string

        // Build the JSON string that contains video metadata
        vidInfo.stdout.on('data', (data) => {
            buildVidInfo.push(data.toString());
        });

        vidInfo.on('close', async () => {
            let infojson;
            let currTime = 0; // Durations in seconds that we have progressed through the current song
            const barLength = 59; // Length in characters of the progress bar to be drawn
            let songDuration; // Total duration in seconds of the current song
            let filledProgressBlocks = 0; // The number of blocks we have filled in our progress bar so far

            try { // Attempt to fetch metadata for the song from youtube
                infojson = JSON.parse(buildVidInfo.join(''));
                songDuration = parseInt(infojson.duration);
            }
            catch {
                // Could not fetch metadata for video, likely because the original video has already been delisted from youtube
                resolve(null);
                return;
            }

            // Update the bot's discord status
            client.user.setActivity(infojson.title);

            // Send a Now Playing message to the channel
            const replyEmbed = new MessageEmbed()
                .setTitle(infojson.title)
                .setAuthor({ name:'Now Playing:' })
                .setURL(url)
                .setThumbnail(infojson.thumbnail)
                .setColor('C4820F')
                .setDescription('`' + createProgressBar(currTime, parseInt(infojson.duration), 59) + '`');

            // Bind currPlayingMessage variable to the message we just sent
            await client.channels.cache.get(botChannel).send({ embeds: [replyEmbed] }).then((message) => {
                currPlayingMessage = message;
                resolve(currPlayingMessage);
            });

            // Continuously update the progress bar in currPlayingMessage
            // This loop will run approximately once every quarter-second
            while (!skipflag && (songDuration - currTime) > 0) {
                if (sharedPlayer.state.status == AudioPlayerStatus.Playing) {
                    // We only redraw the progress bar if there will be a visible change
                    const currProgressBlocks = Math.floor((currTime / songDuration) * barLength);

                    if (currProgressBlocks > filledProgressBlocks) {
                        const updatedProgressBar = '`' + createProgressBar(currTime, songDuration, barLength) + '`';
                        replyEmbed.setDescription(updatedProgressBar);
                        filledProgressBlocks = currProgressBlocks;

                        // Edit the currPlayingMessage with new progress bar
                        // Catch the error that arises when the currPlayingMessage has been manually deleted
                        currPlayingMessage.edit({ embeds: [replyEmbed] }).catch(() => {
                            // Message has been deleted, do nothing and exit early
                            return;
                        });
                    }
                    currTime += 0.25;
                }
                await sleep(250);
            }

            if (skipflag) { // If the current song was manually skipped
                replyEmbed.setDescription('Song skipped.');
            }
            else {
                replyEmbed.setDescription('Playback completed.');
            }

            // Mark the song as completed playback successfully
            replyEmbed.setAuthor({ name:'Finished playing:' });
            currPlayingMessage.edit({ embeds: [replyEmbed] }).catch(() => {
                // Message has been deleted, do nothing and exit
                return;
            });

            // If the Now Playing message was marked for auto-deletion, delete it now
            if (options && options.delete) {
                currPlayingMessage.delete().catch(() => {
                    // Message has been deleted, do nothing and exit
                    return;
                });
            }
        });
    });
};

// Begin playback of song from Youtube URL
// options = { inputType: StreamType.Artibtrary } will pipe audio through ffmpeg
const playyoutube = (url, options) => {
    // Send the Now Playing message
    const currPlayingMessage = playingMessage(url, options);

    // Child process to download audio from youtube video
    const ytdl = spawn(`youtube-dl -f 251/140 --cookies cookies.txt -o - ${url}`, { shell: true, cwd: cacheDir });
    ytdl.on('spawn', () => {
        console.log('\x1b[34m%s\x1b[0m', 'Child process spawned.');
    });

    ytdl.on('close', async (code) => {
        // We pop the currently playing song off of the queue only if it has successfully completed playback
        // or if a manual skip was initiated.
        // That way, if it ended due to an error, it will be queued up again

        if (code == 1 && !skipflag) { // A manual skip was not initiated. Treat it as an HTTP Error and retry
            console.log('Process closed unexpectedly. Retrying...');

            await currPlayingMessage.then(async (mes) => {
                if (mes) {
                    await mes.delete().catch((err) => {
                        console.log(err);
                        console.log('Error trying to delete message.');
                    });
                    console.log('Now Playing message deleted.');
                }
            });
        }
        // A manual skip was initiated. Popping the song off the queue is handled by the
        // sharedPlayer.on('pop') event
        else if (code == 1) {
            console.log(`Closed with code: \x1b[31m${code}\x1b[0m`);
        }

        // Song completed playback successfully. Tell the player to pop it off the queue
        else {
            console.log(`Closed with code: \x1b[31m${code}\x1b[0m`);
            sharedPlayer.emit('pop');
        }
    });

    if (options && options.inputType == StreamType.Arbitrary) {
        sharedPlayer.play(createAudioResource(ytdl.stdout, { inputType: StreamType.Arbitrary }));
    }
    else {
        sharedPlayer.play(createAudioResource(ytdl.stdout, { inputType: StreamType.WebmOpus }));
    }
};

// Play the next song in the cache playlist, and update the index
const playcache = async () => {

    // Send an auto-deleting Now Playing message to the chat
    const youtubeIDRegex = /(\S{11})\.[a-z1-9]{3,}$/;
    const vidID = songNames[index].match(youtubeIDRegex)[1];
    playingMessage(`https://www.youtube.com/watch?v=${vidID}`, { delete:true });

    // probeAndCreateResource to play any kind of audio file
    const songNameRegex = /^(.*)-\S{11}\.[a-z1-9]{3,}/;
    const song = await probeAndCreateResource(fs.createReadStream(path.join(songDir, songNames[index])));
    sharedPlayer.play(song);
    client.user.setActivity(songNames[index].match(songNameRegex)[1]);
    index = (index + 1) % songNames.length;
};


// Player will begin playback of next song in queue upon finishing current song
// Single song requests take precedence over playlist requests
// Playlist requests take precedence over local cached songs
sharedPlayer.on(AudioPlayerStatus.Idle, () => {
    // Wait a second before playing the next song
    sleep(1000);

    // Shuffle the cache playlist upon loop-around
    if (index == 0 && songNames.length > 1) {
        shuffleArray(songNames);
    }

    if (requestqueue.length > 0) {
        currRequest = requestqueue[0];
        playyoutube(requestqueue[0]);
        requestflag = true;
    }
    else if (playlistqueue.length > 0) {
        currRequest = playlistqueue[0];
        playyoutube(playlistqueue[0]);
        requestflag = true;
    }
    else {
        currRequest = '';
        playcache();
        requestflag = false;
    }
});

sharedPlayer.on('skip', async () => {
    skipflag = true;
    sharedPlayer.emit('pop');

    await sleep(250);
    sharedPlayer.stop();
    await sleep(250);

    // Reset the flag
    skipflag = false;
});

// Errors when the Youtube video has m4a audio instead of WebmOpus
sharedPlayer.on('error', async (err) => {
    // Call playyoutube with option to pipe through FFMPEG
    console.log('PLAYER ERROR OCCURRED');
    console.log(err.name);
    console.log(err.message);
    playyoutube(currRequest, { inputType: StreamType.Arbitrary });
});

// Tell the sharedPlayer to pop the current playing song off of its queue
sharedPlayer.on('pop', async () => {
    if (currRequest == requestqueue[0]) {
        requestqueue.shift();
    }
    else if (currRequest == playlistqueue[0]) {
        playlistqueue.shift();
    }
});

// Begin playback with a shuffled playlist
shuffleArray(songNames);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music from provided Youtube URL.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Youtube url or search query.')
                .setRequired(true)),
    player: sharedPlayer,

    // Method to change the default playback playlist
    set playlist(listname) {
        songDir = path.join(cacheDir, listname);
        songNames = fs.readdirSync(path.join(cacheDir, listname)).filter((file) => { return file.endsWith('.opus') || file.endsWith('.webm'); });
        index = 0;
        shuffleArray(songNames);
        if (!requestflag) {
            // Go ahead and skip the current song if it's not a user song request
            sharedPlayer.emit('skip');
        }
    },

    // Method to change the channel the bot is posting too
    set botChannel(channelId) {
        botChannel = channelId;
    },

    clearPlaylistQueue: () => {
        playlistqueue = [];
    },

    async execute(interaction) {
        // If the bot has not been summoned yet, return early
        if (!botChannel) {
            await interaction.reply({ content:'Summon me first!', ephemeral:true });
            return;
        }
        // Handle null edge case
        if (interaction.options.getString('url') == null) {
            await interaction.reply({ content: 'You forgot the URL!', ephemeral: true });
        }
        else {
            // Cut off the url at the ampersand
            let url = interaction.options.getString('url');

            // If input is not a url, then treat it as a search query
            if (!url.match(/youtube.com|youtu.be/)) {
                await interaction.reply({ embeds: [new MessageEmbed().setAuthor({ name:'Grabbing video info...' })] });
                // Use youtube-dl to perform a search of this query
                const getvidurl = spawn(`youtube-dl --cookies cookies.txt --get-id ytsearch1:"${url}"`, { shell: true, cwd: cacheDir });
                let vidurl;

                getvidurl.stdout.on('data', (data) => {
                    vidurl = `https://www.youtube.com/watch?v=${data.toString()}`;
                });

                getvidurl.on('close', async () => {
                    const buildvidinfo = []; // The video info json string
                    const vidinfo = spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${vidurl}`, { shell: true, cwd: cacheDir });
                    requestqueue.push(vidurl);

                    // Build video info json string
                    vidinfo.stdout.on('data', (data) => {
                        buildvidinfo.push(data.toString());
                    });

                    // On finishing retrieval of video info, grab the description from the resulting json string
                    // Post a reply confirming the song has been added to queue
                    vidinfo.on('close', async () => {
                        let infojson;
                        try {
                            infojson = JSON.parse(buildvidinfo.join(''));
                        }
                        catch { // On the event that a connection interruption results in a malformed JSON, exit early
                            interaction.editReply({ content:'Attempted to parse malformed JSON' });
                            return;
                        }

                        // Cut off at the first 10 lines of a description
                        let descriptionLines = infojson.description.split('\n');
                        if (descriptionLines.length > 10) {
                            descriptionLines = descriptionLines.slice(0, 10);
                            descriptionLines.push('。。。。。');
                        }
                        const replyEmbed = new MessageEmbed()
                            .setTitle(infojson.title)
                            .setURL(vidurl)
                            .setThumbnail(infojson.thumbnail)
                            .setDescription(descriptionLines.join('\n'))
                            .setColor('003262');

                        // If there were no prior requests, skip the current song.
                        if (!requestflag) {
                            replyEmbed.setAuthor({ name:'Now playing:' });
                            await interaction.editReply({ embeds: [replyEmbed] });
                            sharedPlayer.emit('skip');
                        }
                        // Else, queue up the requested song
                        else {
                            replyEmbed.setAuthor({ name:'Added to queue:' });
                            await interaction.editReply({ embeds: [replyEmbed] });
                        }

                    });
                });
            }

            // Handle a link to a whole playlist
            // In this case, we queue up every song in the playlist
            else if (url.match(/playlist\?list=/)) {
                // Extract the playlist id from the url https://www.youtube.com/feeds/videos.xml?playlist_id=
                const jsonArray = []; // Array of json strings correlating to every song in the playlist
                const playlistId = url.match(/list=(\S+)/)[1];
                const command = `youtube-dl -j --flat-playlist --cookies cookies.txt ${url}`;
                const playlistinfo = spawn(command, { shell: true, cwd: cacheDir });
                // Use an https get request to pull the playlist title
                const request = https.get(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`);

                playlistinfo.stdout.on('data', (data) => {
                    jsonArray.push(data.toString());
                });

                playlistinfo.on('close', async () => {
                    for (let i = 0; i < jsonArray.length; i++) {
                        if (jsonArray[i].length > 0) {
                            let songId;
                            try {
                                songId = JSON.parse(jsonArray[i]).id;
                            }
                            catch { // Exit early on attempt to parse malformed JSON
                                await interaction.reply('`Attempted to parse malformed JSON. Try again.`');
                                return;
                            }
                            playlistqueue.push(`https://www.youtube.com/watch?v=${songId}`);
                        }
                    }
                    // If current playing song is not a request, just skip it
                    if (!requestflag) {
                        sharedPlayer.emit('skip');
                    }
                });

                request.on('response', async (response) => {
                    response.setEncoding('utf8');
                    let body = '';
                    response.on('data', (data) => {
                        body += data;
                    });
                    response.on('end', async () => {
                        const playlistTitle = body.match(/<title>(.+)<\/title>/);
                        if (playlistTitle) {
                            await interaction.reply(`\`Queued the playlist: ${playlistTitle[1]}\``);
                        }
                        else {
                            await interaction.reply('`Queued a playlist.`');
                        }
                    });
                });
            }
            // Handle the case of a normal url
            else {
                url = url.match(/^([^&]*)/)[1]; // Capture everything before the first ampersand
                await interaction.reply({ embeds: [new MessageEmbed().setAuthor({ name:'Grabbing video info...' })] });

                const vidinfo = spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${url}`, { shell: true, cwd: cacheDir });
                requestqueue.push(url);
                const buildvidinfo = [];

                vidinfo.stdout.on('data', (data) => {
                    buildvidinfo.push(data.toString());
                });

                // Post reply confirming the song has been added to the queue
                vidinfo.on('close', async () => {
                    let infojson;
                    try {
                        infojson = JSON.parse(buildvidinfo.join(''));
                    }
                    catch { // Exit early on attempt to parse malformed JSON
                        interaction.editReply({ content:'Attempted to parse malformed JSON' });
                        return;
                    }

                    // Cut off the description at the first 10 lines of a description
                    let descriptionLines = infojson.description.split('\n');
                    if (descriptionLines.length > 10) {
                        descriptionLines = descriptionLines.slice(0, 10);
                        descriptionLines.push('。。。。。');
                    }
                    const replyEmbed = new MessageEmbed()
                        .setTitle(infojson.title)
                        .setURL(url)
                        .setThumbnail(infojson.thumbnail)
                        .setDescription(descriptionLines.join('\n'))
                        .setColor('003262');

                    // If there were no prior requests, skip the current song.
                    if (!requestflag) {
                        replyEmbed.setAuthor({ name:'Now playing:' });
                        await interaction.editReply({ embeds: [replyEmbed] });
                        sharedPlayer.emit('skip');
                    }
                    else {
                        replyEmbed.setAuthor({ name:'Added to queue:' });
                        await interaction.editReply({ embeds: [replyEmbed] });
                    }
                });
            }
        }
    },
};
