module.exports = {
    name: 'newActivity',
    once: false,
    execute(client, activity) {
        console.log('Got the signal~');
        client.setActivity(activity);
    },
};