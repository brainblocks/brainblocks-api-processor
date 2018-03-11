
let request = require('request-promise');
let fs = require('fs');
let exec = require('child-process-promise').exec;

let { wait, noop } = require('./util');
let { config } = require('../config');
let { logger } = require('./logger');

const RAI_EXECUTABLE = [
    '/Applications/RaiBlocks.app/Contents/MacOS/rai_wallet',
    '/home/brainblocks/raiblocks/rai_node'
].find(path => fs.existsSync(path));

const PROTECTED_ACCOUNT = 'xrb_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y';

module.exports.raiAction = async function raiAction(action, args = {}, allowFixWalletError = true) {

    console.log((new Date).toUTCString(), 'START', action, args);

    let res;

    try {
        res = await request({
            method: 'POST',
            uri: config.rai_server,
            body: JSON.stringify({
                action: action,
                ...args
            }),
            resolveWithFullResponse: true
        });

        if (!res.statusCode) {
            throw new Error(`Expected status code from rai node`);
        }
        
    } catch (err) {
        await wait(8000);

        res = await request({
            method: 'POST',
            uri: config.rai_server,
            body: JSON.stringify({
                action: action,
                ...args
            }),
            resolveWithFullResponse: true
        });
    }

    console.log((new Date).toUTCString(), 'COMPLETE', action, args, res.body);
    logger.log({ action, ...args });

    if (res.statusCode !== 200) {
        throw new Error(`Expected status to be 200, got ${ res.statusCode} for action: ${ action }`);
    }
    
    let data = JSON.parse(res.body);

    if (data.error) {

        if (data.error === 'Wallet locked' && allowFixWalletError) {
            await module.exports.raiAction('wallet_unlock', { wallet: args.wallet, password: '' }, false);
            await module.exports.raiAction(action, args, false);
        }

        logger.log({ rai_error: data.error });
        let err = new Error(data.error);
        err.data = args;

        throw err;
    }

    return data;
}

module.exports.unlockWallet = async function unlockWallet(wallet) {
    await module.exports.raiAction('wallet_unlock', { wallet, password: '' });
}

module.exports.raiCLIAction = async function raiCLIAction(action) {
    let result = await exec(`${ RAI_EXECUTABLE } --${action}`);
    if (result.stderr) {
        throw new Error(result.stderr);
    }
    return result.stdout;
}

module.exports.walletList = async function walletList() {
    let rawWalletList = await module.exports.raiCLIAction('wallet_list');

    let result = [];
    
    rawWalletList.split('\n').forEach(line => {
        if (line.trim().match(/^Wallet ID:/)) {
            result.push({
                wallet: line.replace('Wallet ID:', '').trim(),
                accounts: []
            });
        } else if (line.trim().match(/^xrb_/)) {
            result[result.length - 1].accounts.push(line.trim())
        }
    });

    return result;
}

module.exports.walletCreate = async function walletCreate() {
    return (await module.exports.raiAction('wallet_create')).wallet;
}

module.exports.walletUnlock = async function walletUnlock(wallet) {
    return await module.exports.raiAction('password_enter', { wallet, password: '' });
}

module.exports.accountCreate = async function accountCreate(wallet) {
    let { private, public, account } = await module.exports.raiAction('key_create');
    await module.exports.raiAction('wallet_add', { wallet, key: private });
    return { private, public, account };
}

module.exports.walletPoolGet = async function walletAccountPoolGet() {
    let wallets = await module.exports.walletList();

    if (wallets.length < 100) {
        return await module.exports.walletCreate();
    }

    wallets.sort((a, b) => {
        return a.accounts.length - b.accounts.length;
    });

    return wallets[0].wallet;
}

module.exports.walletAccountCreate = async function walletAccountCreate() {
    let wallet = await module.exports.walletPoolGet();
    await module.exports.walletUnlock(wallet);
    let { private, public, account } = await module.exports.accountCreate(wallet);

    return { wallet, account, private, public };
}

module.exports.getBalance = async function getBalance(account) {
    let { balance, pending } = await module.exports.raiAction('account_balance', { account: account });
    
    [ balance, pending ] = await Promise.all([ module.exports.rawToRai(balance), module.exports.rawToRai(pending) ]);

    return { balance, pending };
}

module.exports.getPending = async function getPending(account) {
    return (await module.exports.raiAction('pending', {
        account: account,
        count: '100'
    })).blocks;
}

module.exports.blockInfo = async function blockInfo(block) {
    let result = (await module.exports.raiAction('blocks_info', {
        hashes: [ block ]
    })).blocks[block];

    result.amount = await module.exports.rawToRai(result.amount);
    result.contents = JSON.parse(result.contents);

    return result;
}

module.exports.raiToRaw = async function raiToRaw(rai) {
    if (rai === 0) {
        return '0';
    }
    return (await module.exports.raiAction('rai_to_raw', { amount: rai.toString() })).amount;
}

module.exports.rawToRai = async function rawToRai(raw) {
    if (raw === '0') {
        return 0;
    }
    return parseInt((await module.exports.raiAction('rai_from_raw', { amount: raw })).amount);
}

module.exports.receive = async function receive(wallet, account, block) {
    return await module.exports.raiAction('receive', {
        wallet: wallet,
        account: account,
        block: block
    });
}

module.exports.destroyWallet = async function destroyWallet(wallet) {
    try {
        await module.exports.raiAction('wallet_destroy', { wallet });
    } catch (err) {
        if (err.message === 'Wallet not found') {
            return;
        }
        throw err;
    }
}

module.exports.send = async function send(wallet, account, amount, destination) {
    if (account === PROTECTED_ACCOUNT) {
        return;
    }

    return await module.exports.raiAction('send', {
        wallet: wallet,
        source: account,
        amount: await module.exports.raiToRaw(amount),
        destination: destination
    });
}

module.exports.receiveAllPending = async function receiveAllPending(wallet, account) {
    let blocks = await module.exports.getPending(account);

    for (let block of blocks) {
        await module.exports.receive(wallet, account, block);
    }

    let { balance, pending } = await module.exports.getBalance(account);

    return { balance, pending };
}

module.exports.accountHistory = async function accountHistory(account) {
    return (await module.exports.raiAction('account_history', {
        account: account,
        count: '100'
    })).history || [];
}

module.exports.getReceived = async function getReceived(account) {
    let history = await module.exports.accountHistory(account);
    return history.filter(entry => entry.type === 'receive');
}

module.exports.getSent = async function getSent(account) {
    let history = await module.exports.accountHistory(account);
    return history.filter(entry => entry.type === 'send');
}

module.exports.getLastReceived = async function getLastReceived(account) {
    return (await module.exports.getReceived(account))[0];
}

module.exports.getLastSent = async function getLastSent(account) {
    return (await module.exports.getSent(account))[0];
}

module.exports.getTotalReceived = async function getTotalReceived(account) {
    let received = await module.exports.getReceived(account);
    let pending = await module.exports.getPending(account);

    let blocks = [];

    for (let item of received) {
        if (blocks.indexOf(item.hash) === -1) {
            blocks.push(item.hash);
        }
    }

    for (let hash of pending) {
        if (blocks.indexOf(hash) === -1) {
            blocks.push(hash);
        }
    }

    let totals = await Promise.all(blocks.map(async (block) => {
        let info = await module.exports.blockInfo(block);
        return info.amount;
    }));

    let total = totals.reduce((a, b) => a + b, 0);

    return total;
}

module.exports.refundAccount = async function refundAccount(wallet, account) {

    if (account === PROTECTED_ACCOUNT) {
        return;
    }

    let { balance } = await module.exports.receiveAllPending(wallet, account);

    if (!balance) {
        return;
    }

    let received = await module.exports.getReceived(account);

    for (let transaction of received) {
        let refundAmount = Math.min(balance, await module.exports.rawToRai(transaction.amount));
        await module.exports.send(wallet, account, refundAmount, transaction.account);
        balance -= refundAmount;

        if (!balance) {
            break;
        }
    }
}

module.exports.getLatestSendBlock = async function getLatestBlock(account) {
    let received = await module.exports.getReceived(account);

    if (received.length) {
        let receiveBlock = received[received.length - 1].hash;
        let info = await module.exports.blockInfo(receiveBlock);
        return info.contents.source;
    }

    let pending = await module.exports.getPending(account);

    if (pending.length) {
        return pending[pending.length - 1];
    }
}

module.exports.getLatestTransaction = async function getLatestTransaction(account) {
    
    let send_block = await module.exports.getLatestSendBlock(account);

    if (!send_block) {
        throw new Error(`No recent transactions found`);
    }

    let info = await module.exports.blockInfo(send_block);
    let sender = info.block_account;

    return { send_block, sender };
}

module.exports.removeAccount = async function removeAccount(wallet, account) {
    try {
        await module.exports.raiAction('account_remove', { wallet, account });
    } catch (err) {
        if (err.message === 'Wallet not found') {
            return;
        }
        if (err.message === 'Account not found in wallet') {
            return;
        }
        throw err;
    }
};

module.exports.walletBalances = async function walletBalances(wallet) {
    let result = await module.exports.raiAction('wallet_balances', { wallet });
    return result && result.balances || {};
}

module.exports.walletExists = async function walletExists(wallet) {
    try {
        await module.exports.walletBalances(wallet);
        return true;
    } catch (err) {
        return false;
    }
}

module.exports.cleanupWallets = async function cleanupWallets() {
    let wallets = await module.exports.walletList();

    console.log('Waiting 30 seconds before cleaning up wallets');

    await wait(30 * 1000);

    console.log('Cleaning addresses after 30 seconds');

    for (let { wallet, accounts } of wallets) {
        if (!accounts.length && await module.exports.walletExists(wallet)) {
            if (!Object.keys(await module.exports.walletBalances(wallet)).length) {
                await module.exports.destroyWallet(wallet);
            }
        }
    }
}
module.exports.waitForBalance = async function waitForBalance({ wallet, account, amount, timeout = 120000, delay = 5000, onCancel = noop }) {

    let start = Date.now();
    let cancelled = false;

    onCancel(() => {
        cancelled = true;
    });
    
    while (true) {
        await wait(delay);

        let elapsed = Date.now() - start;

        if (elapsed > (timeout / 2)) {
            delay = delay * 2;
        }

        let { balance, pending } = await module.exports.getBalance(account);

        if ((balance + pending) >= amount) {
            return { balance, pending };
        }

        if (cancelled || elapsed > timeout) {
            return { balance, pending };
        }
    }
}

module.exports.recoverAccount = async function recoverAccount(private) {
    let wallet = await module.exports.walletPoolGet();
    let result = await module.exports.raiAction('wallet_add', { wallet, key: private });
    let account = result.account;
    return { wallet, account };
}

module.exports.recoverAndRefundAccount = async function recoverAndRefundAccount(private) {
    let { wallet, account } = await module.exports.recoverAccount(private);
    await module.exports.refundAccount(wallet, account);
}