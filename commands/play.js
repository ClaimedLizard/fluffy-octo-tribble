const { SlashCommandBuilder } = require('@discordjs/builders');
const { createAudioResource, createAudioPlayer, AudioPlayerStatus, demuxProbe, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { client } = require('../client.js');
const { MessageEmbed } = require('discord.js');
// const jsdom = require('jsdom');

const sharedPlayer = createAudioPlayer();

const { BOTSTUFFCHANNEL } = require('../config.json');

// Initialize the list of cached songs to play
const cacheDir = path.resolve('./cache');
let songDir = path.join(cacheDir, 'Chinois');
let songNames = fs.readdirSync(songDir).filter((file) => { return file.endsWith('.opus'); });
const requestqueue = []; // Queue for individual song requests. Will take precedence over playlistqueue
let playlistqueue = []; // Queue for whole playlist requsts. Will take precedence over cached songs
// let playlistTitle; // The name of the currently playing playlist
let currRequest = ''; // Is the url string of the song request currently playing.

let index = 0; // Index of the current song playing
let requestflag = false; // Will be true if the current song playing is a request
let skipflag = false; // Will be true if user requested to skip the current song
let messageskipflag = false; // Another skip flag for currPlayingMessage to reference

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

const createProgressBar = (curr, total, length) => {
    // Create a progress bar out of characters
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

// Begin playback of song from Youtube URL
// options = { inputType: StreamType.Artibtrary } will pipe audio through ffmpeg
const playyoutube = (url, options) => {
    // const urlId = url.split('watch?v=')[1];
    const vidinfo = spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${url}`, { shell: true, cwd: cacheDir });
    const ytdl = spawn(`youtube-dl -f 251/140 --cookies cookies.txt -o - ${url}`, { shell: true, cwd: cacheDir });
    let currPlayingMessage; // Message displaying the currently playing song
    const buildvidinfo = [];

    /*
    if (options && options.cacheLocal) {
        spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${url} > ${urlId}.info.json`, { shell: true, cwd: cacheDir + `/${playlistTitle}` });
    }
    */

    vidinfo.stdout.on('data', (data) => {
        buildvidinfo.push(data.toString());
    });

    vidinfo.on('close', async () => {
        const infojson = JSON.parse(buildvidinfo.join(''));
        client.user.setActivity(infojson.title);
        let currTime = 0;

        /*
        // Download the song as it is playing
        if (options && options.cacheLocal) {
            fs.access(`/${playlistTitle}`, fs.constants.F_OK, (err) => {
                if (err) {
                    fs.mkdir(`./cache/${playlistTitle}`, (err) => {
                        if (err & err.errno != 17) throw err;
                    });
                }
            });
            ytdl.stdout.on('data', (data) => {
                fs.appendFile(`./cache/${playlistTitle}/` + urlId, data, (err) => {
                    if (err) throw err;
                });
            });
        }
        */

        // Send a Currently Playing message to the channel
        const replyEmbed = new MessageEmbed()
            .setTitle(infojson.title)
            .setAuthor({ name:'Now Playing:' })
            .setURL(url)
            .setThumbnail(infojson.thumbnail)
            .setColor('C4820F')
            .setDescription('`' + createProgressBar(currTime, parseInt(infojson.duration), 59) + '`');

        // Bind currPlayingMessage variable to the message we just sent
        await client.channels.cache.get(BOTSTUFFCHANNEL).send({ embeds: [replyEmbed] }).then((message) => {
            currPlayingMessage = message;
        });

        // Constantly update the progress bar in currPlayingMessage
        while (!messageskipflag && (parseInt(infojson.duration) - currTime) > 0) {
            if (sharedPlayer.state.status == AudioPlayerStatus.Playing) {
                const updatedProgressBar = '`' + createProgressBar(currTime, parseInt(infojson.duration), 59) + '`';
                currTime += 1;

                if (updatedProgressBar != replyEmbed.description) {
                    replyEmbed.setDescription(updatedProgressBar);
                    try {
                        currPlayingMessage.edit({ embeds: [replyEmbed] });
                    }
                    catch {
                        break;
                    }
                }
            }

            await sleep(1000);
        }
        if (messageskipflag) {
            replyEmbed.setDescription('Song skipped.');
            messageskipflag = false;
        }
        else {
            replyEmbed.setDescription('Playback completed.');
        }
        replyEmbed.setAuthor({ name:'Finished playing:' });
        try {
            currPlayingMessage.edit({ embeds: [replyEmbed] });
        }
        catch {
            console.log('Tried to edit a deleted message.');
        }
    });

    ytdl.on('spawn', () => {
        console.log('\x1b[34m%s\x1b[0m', 'Child process spawned.');
    });

    ytdl.on('close', async (code) => {
        if (code == 1 && !skipflag) { // A manual skip was not initiated. Treat it as an HTTP Error and retry
            console.log('Process closed unexpectedly. Retrying...');
            if (currPlayingMessage) {
                currPlayingMessage.delete().then((message) => {
                    message.deleted = true;
                });
            }
            else { // Wait for the message to be sent first, then delete
                await sleep(1000);
                currPlayingMessage.delete().then((message) => {
                    message.deleted = true;
                });
            }
        }
        else if (code == 1) { // A manual skip was initiaed
            console.log(`Closed with code: \x1b[31m${code}\x1b[0m`);
            if (currRequest == requestqueue[0]) {
                requestqueue.shift();
            }
            else if (currRequest == playlistqueue[0]) {
                playlistqueue.shift();
            }
            skipflag = false;
        }
        else {
            console.log(`Closed with code: \x1b[31m${code}\x1b[0m`);
            if (currRequest == requestqueue[0]) {
                requestqueue.shift();
            }
            else if (currRequest == playlistqueue[0]) {
                playlistqueue.shift();
            }
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
    // probeAndCreateResource to play any kind of audio file
    const song = await probeAndCreateResource(fs.createReadStream(path.join(songDir, songNames[index])));
    sharedPlayer.play(song);
    client.user.setActivity(songNames[index].substring(0, (songNames[index].length - 17)));
    index = (index + 1) % songNames.length;
    await sleep(1000);
    skipflag = false;
    messageskipflag = false;
};

shuffleArray(songNames);

// Player will begin playback of next song in queue upon finishing current song
sharedPlayer.on(AudioPlayerStatus.Idle, () => {
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
    messageskipflag = true;
    await sleep(1000);
    if (currRequest == requestqueue[0]) {
        requestqueue.shift();
        sharedPlayer.stop();
    }
    else if (currRequest == playlistqueue[0]) {
        playlistqueue.shift();
        sharedPlayer.stop();
    }
    else {
        sharedPlayer.stop();
    }
});

// Errors when the Youtube video has m4a audio instead of WebmOpus
sharedPlayer.on('error', async () => {
    playyoutube(currRequest, { inputType: StreamType.Arbitrary });
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music from provided Youtube URL.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Youtube url or search query.')
                .setRequired(true)),
    player: sharedPlayer,
    playcache: playcache,
    skipflag: skipflag,
    messageskipflag: messageskipflag,

    // Method to change the default playback playlist
    set playlist(listname) {
        songDir = path.join(cacheDir, listname);
        songNames = fs.readdirSync(path.join(cacheDir, listname)).filter((file) => { return file.endsWith('.opus'); });
        index = 0;
        if (!requestflag) {
            sharedPlayer.stop();
        }
    },

    clearPlaylistQueue: () => {
        playlistqueue = [];
    },

    async execute(interaction) {
        // Handle null edge case
        if (interaction.options.getString('url') == null) {
            await interaction.reply({ content: 'You forgot the URL!', ephemeral: true });
        }
        else {
            // Cut off the url at the ampersand
            const url = interaction.options.getString('url').split('&')[0];

            // If input is not a url, then treat it as a search query
            if (url.indexOf('youtube.com') == -1 && url.indexOf('youtu.be' == -1)) {
                await interaction.reply({ embeds: [new MessageEmbed().setAuthor({ name:'Grabbing video info...' })] });
                const getvidurl = spawn(`youtube-dl --cookies cookies.txt --get-id ytsearch1:"${url}"`, { shell: true, cwd: cacheDir });
                let vidurl;

                getvidurl.stdout.on('data', (data) => {
                    vidurl = `https://www.youtube.com/watch?v=${data.toString()}`;
                });

                getvidurl.on('close', async () => {
                    const buildvidinfo = [];
                    const vidinfo = spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${vidurl}`, { shell: true, cwd: cacheDir });
                    requestqueue.push(vidurl);

                    vidinfo.stdout.on('data', (data) => {
                        buildvidinfo.push(data.toString());
                    });

                    vidinfo.on('close', async () => {
                        const infojson = JSON.parse(buildvidinfo.join(''));
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
                            sharedPlayer.stop();
                        }
                        else {
                            replyEmbed.setAuthor({ name:'Added to queue:' });
                            await interaction.editReply({ embeds: [replyEmbed] });
                        }

                    });
                });
            }

            // The link is to a whole playlist
            else if (url.indexOf('playlist') !== -1) {
                const command = `youtube-dl -j --flat-playlist --cookies cookies.txt ${url}`;
                const playlistinfo = spawn(command, { shell: true, cwd: cacheDir });
                playlistqueue = []; // Empty the playlist queue
                const jsonArray = [];

                playlistinfo.stdout.on('data', (data) => {
                    jsonArray.push(data.toString());
                });

                playlistinfo.on('close', async () => {
                    for (let i = 0; i < jsonArray.length; i++) {
                        if (jsonArray[i].length > 0) {
                            playlistqueue.push(`https://www.youtube.com/watch?v=${JSON.parse(jsonArray[i]).id}`);
                        }
                    }

                    /*
                    // User agent so we fetch the correct HTML
                    const rl = new jsdom.ResourceLoader({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36' });
                    await jsdom.JSDOM.fromURL(url, { resources: rl }).then(async (dom) => {
                        playlistTitle = await dom.window.document.body.querySelector('meta[property="og:title"]').content;
                        await interaction.reply(`\`Queued the playlist: ${playlistTitle}\``);
                    });
                    */
                    await interaction.reply('`Queued a playlist.`');
                    if (!requestflag) {
                        sharedPlayer.stop();
                    }
                });
            }
            else {
                await interaction.reply({ embeds: [new MessageEmbed().setAuthor({ name:'Grabbing video info...' })] });

                const vidinfo = spawn(`youtube-dl --dump-json --skip-download --cookies cookies.txt ${url}`, { shell: true, cwd: cacheDir });
                requestqueue.push(url);
                const buildvidinfo = [];

                vidinfo.stdout.on('data', (data) => {
                    buildvidinfo.push(data.toString());
                });

                vidinfo.on('close', async () => {
                    const infojson = JSON.parse(buildvidinfo.join(''));
                    // Cut off at the first 10 lines of a description
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
                        sharedPlayer.stop();
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
