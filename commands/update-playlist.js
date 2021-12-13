const { SlashCommandBuilder } = require ('@discordjs/builders');
const { spawn } = require('child_process');
const path = require('path');

const sleep = async (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update-playlist')
        .setDescription('Update cached songs from youtube playlist.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the playlist.')
                .setRequired(true)
                .addChoice('NotNicobox', 'NotNicobox')
                .addChoice('Chinois', 'Chinois')),
    async execute(interaction) {
        const command = './update-playlist.sh';
        const workingDir = path.join(path.resolve('./cache'), interaction.options.getString('name'));

        // Restart the update process upon an error
        const updateLoop = (spawned) => {
            spawned.on('close', async (code) => {
                if (code != 0) {
                    console.log('ERROR OCCURRED. RESTARTING PROCESS.');
                    await sleep(3000);
                    updateLoop(spawn(command, { cwd: workingDir, shell: true })); // Recursive call
                }
                else {
                    console.log(`Process exited with code: ${code}`);
                }
            });
            spawned.stdout.on('data', (data) => {
                console.log(data.toString());
            });
        };

        updateLoop(spawn(command, { cwd: workingDir, shell: true }));

        await interaction.reply({ content: 'Update process has begun. Check console.', ephemeral: true });
    },
};