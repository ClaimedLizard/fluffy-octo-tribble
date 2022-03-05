const { SlashCommandBuilder } = require ('@discordjs/builders');
const http = require('http');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boobs')
        .setDescription('Replies with boobs!'),
    async execute(interaction) {
        http.get(`http://api.oboobs.ru/boobs/${Math.floor(Math.random() * 10330)}`, async (res) => {
            let httpError = false; // Will be true if we encountered an http error

            if (res.statusCode != '200') {
                await interaction.reply({ content: 'HTTP error' });
                httpError = true;
                return;
            }

            let body = '';
            res.on('data', (data) => {
                body += data;
            });

            res.on('close', async () => {
                if (!httpError) {
                    const picId = body.match(/"preview": "(boobs_preview\/\d{1,}\.jpg)"/)[1];
                    await interaction.reply({ content:`http://media.oboobs.ru/${picId}` });
                }
            });
        });
    },
};
