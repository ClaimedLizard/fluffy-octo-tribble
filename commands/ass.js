const { SlashCommandBuilder } = require ('@discordjs/builders');
const http = require('http');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ass')
        .setDescription('Replies with ass!'),
    async execute(interaction) {
        http.get(`http://api.obutts.ru/butts/${Math.floor(Math.random() * 4335)}`, async (res) => {
            if (res.statusCode != '200') {
                await interaction.reply({ content: 'HTTP error' });
                return;
            }

            let body = '';
            res.on('data', (data) => {
                body += data;
            });

            res.on('close', async () => {
                const picId = body.match(/"preview": "(butts_preview\/\d{1,}\.jpg)"/)[1];
                await interaction.reply({ content:`http://media.obutts.ru/${picId}` });
            });
        });
    },
};
