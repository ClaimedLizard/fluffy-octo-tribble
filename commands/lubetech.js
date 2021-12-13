const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lubetech')
        .setDescription('Grab the next RO from the shitlist.'),
    async execute(interaction) {
        const carModels = ['Camry', 'Corolla', 'Prius', 'Tacoma', '4Runner', 'Venza', 'Sienna', 'Rav4', 'Tundra'];
        const services = ['05KSYN', '10KSYN', '15KSYN', '20KSYN', '25KSYN'];
        const currCar = carModels[Math.floor(Math.random() * carModels.length)];
        const currService = services[Math.floor(Math.random() * services.length)];
        await interaction.reply(`${currCar} ${currService}`);
    }

}