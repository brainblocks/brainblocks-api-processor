
require('babel-register');
let { withPrivate, getBalance, send } = require('./server/lib/rai');

async function processTransaction() {
    let privateKey = '29B0914E7951260242FF2D9783600579DE252F40D7EEC15F5A6D11936EE1AB01';
    let amount_rai = 1000;
    let destination = 'xrb_11iaqa1oppdxzawrbuzh4m5y78i9zngnhwp8urpup97fsf7k8e84gf61ei75';

    await withPrivate(privateKey, async ({ wallet, account }) => {
        await getBalance(account);
        await getBalance(destination);
        await send(wallet, account, amount_rai, destination);
    });
}

processTransaction();