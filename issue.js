
require('babel-register');
let { withPrivate, getBalance, send, receiveAllPending, accountCreate } = require('./server/lib/rai');

const readline = require('readline');

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

async function processTransaction() {

    let { account, privateKey, publicKey } = await accountCreate();
    console.warn(`Send 1000 to ${ account } and press any key`);

    await new Promise(resolve => {
        process.stdin.on('keypress', resolve);
    });

    let amount_rai = 1000;
    let destination = 'xrb_11iaqa1oppdxzawrbuzh4m5y78i9zngnhwp8urpup97fsf7k8e84gf61ei75';

    await receiveAllPending(privateKey);
    await send(privateKey, amount_rai, destination);

    process.exit();
}

processTransaction().catch(() => process.exit());
