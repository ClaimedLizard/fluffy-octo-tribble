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
                .addChoice('Chinois', 'Chinois')
                .addChoice('ToTheMoonLofi', 'ToTheMoonLofi')),
    async execute(interaction) {
        const command = './update-playlist.sh'; // The specific shell command is specified in this .sh file
        const workingDir = path.join(path.resolve('./cache'), interaction.options.getString('name'));

        // Restart the update process upon an error
        const updateLoop = async (spawned) => {

            spawned.stdout.on('data', async (data) => {
                await sleep(1000);
                console.log(data.toString());
            });

            spawned.on('close', async (code) => {
                if (code != 0) {
                    console.log('\x1b[31m%s\x1b[0m', 'ERROR OCCURRED. RESTARTING PROCESS.');
                    await sleep(3000);
                    updateLoop(spawn(command, { cwd: workingDir, shell: true })); // Recursive call
                }
                else {
                    console.log(`Process exited with code: ${code}`);
                }

            });
        };

        updateLoop(spawn(command, { cwd: workingDir, shell: true }));

        await interaction.reply({ content: 'Update process has begun. Check console.', ephemeral: true });
    },
};
