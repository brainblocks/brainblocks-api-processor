
let amqp = require('amqplib');
let amqpDelay = require('amqp-delay.node');
let exitHook = require('async-exit-hook');

let { wait } = require('./util');

const URI = 'amqp://localhost';

let conn;
let chan;

async function getConnection() {
    if (!conn) {
        conn = amqp.connect(URI);
        
        (await conn).on('close', () => {
            conn = amqp.connect(URI);
        });
    }

    let channel = await (await conn).createChannel();

    return channel;
}

module.exports.subscribe = async function subscribe(queue, handler, options = {}) {
    let channel = await getConnection();
    await channel.assertQueue(queue, { durable: true });
    channel.prefetch(1);

    if (options.singleton) {
        await channel.purgeQueue(queue);
    }

    if (options.cancelOnExit) {
        exitHook(async (callback) => {
            await channel.deleteQueue(queue);
            callback();
        });
    }

    channel.consume(queue, async (msg) => {
        try {
            if (msg !== null) {
                let data = JSON.parse(msg.content.toString());
                console.log('RABBIT RECIEVE:', data);
                await handler(data);
                channel.ack(msg);
            }
        } catch (err) {
            console.error(err.stack || err.message);

            if (msg.fields.redelivered) {
                return channel.ack(msg);
            }

            await wait(30000);
            channel.nack(msg);
        }
    });

    return {
        async cancel() {
            await channel.deleteQueue(queue);
        }
    };
}

module.exports.publish = async function publish(queue, message = {}) {
    let channel = await getConnection();
    await channel.assertQueue(queue, { durable: true });

    console.log('RABBIT SEND:', message);

    return channel.sendToQueue(queue, new Buffer(JSON.stringify(message)), { persistent: true });
}