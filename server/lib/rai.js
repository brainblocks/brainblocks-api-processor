/* @flow */

import { existsSync } from 'fs';

import request from 'request-promise';
import { exec } from 'child-process-promise';

import { config } from '../config';

import { logger } from './logger';
import { wait, noop } from './util';

const RAI_EXECUTABLE = [
    '/Applications/RaiBlocks.app/Contents/MacOS/rai_wallet',
    '/home/brainblocks/raiblocks/rai_node'
].find(existsSync);

if (!RAI_EXECUTABLE) {
    throw new Error(`Can not find rai executable`);
}

export async function raiAction<R : Object>(action : string, args : Object = {}) : Promise<R> {

    console.log((new Date()).toUTCString(), 'START', action, args);

    let res;

    try {
        res = await request({
            method: 'POST',
            uri:    config.rai_server,
            body:   JSON.stringify({
                action,
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
            uri:    config.rai_server,
            body:   JSON.stringify({
                action,
                ...args
            }),
            resolveWithFullResponse: true
        });
    }

    console.log((new Date()).toUTCString(), 'COMPLETE', action, args, res.body);
    logger.log({ action, ...args });

    if (res.statusCode !== 200) {
        throw new Error(`Expected status to be 200, got ${ res.statusCode } for action: ${ action }`);
    }
    
    let data = JSON.parse(res.body);

    if (data.error) {

        logger.log({ rai_error: data.error });
        let err = new Error(data.error);

        // $FlowFixMe
        err.data = args;

        throw err;
    }

    return data;
}

export async function raiToRaw(rai : number) : Promise<string> {
    if (rai === 0) {
        return '0';
    }
    return (await raiAction('rai_to_raw', { amount: rai.toString() })).amount;
}

export async function rawToRai(raw : string) : Promise<number> {
    if (raw === '0') {
        return 0;
    }
    return parseInt((await raiAction('rai_from_raw', { amount: raw })).amount, 10);
}

export async function isAccountValid(account : string) : Promise<boolean> {
    return (await raiAction('validate_account_number', { account })).valid === '1';
}

export async function raiCLIAction(action : string) : Promise<string> {
    let result = await exec(`${ RAI_EXECUTABLE } --${ action }`);
    if (result.stderr) {
        throw new Error(result.stderr);
    }
    return result.stdout;
}

export async function walletList() : Promise<Array<{ wallet : string, accounts : Array<string> }>> {
    let rawWalletList = await raiCLIAction('wallet_list');

    let result = [];
    
    rawWalletList.split('\n').forEach(line => {
        if (line.trim().match(/^Wallet ID:/)) {
            result.push({
                wallet:   line.replace('Wallet ID:', '').trim(),
                accounts: []
            });
        } else if (line.trim().match(/^xrb_/)) {
            result[result.length - 1].accounts.push(line.trim());
        }
    });

    return result;
}

export async function walletCreate() : Promise<string> {
    return (await raiAction('wallet_create')).wallet;
}

export async function walletUnlock(wallet : string) : Promise<void> {
    return await raiAction('password_enter', { wallet, password: '' });
}

export async function accountCreate() : Promise<{ account : string, privateKey : string, publicKey : string }> {
    let { private: privateKey, public: publicKey, account } = await raiAction('key_create');
    return { account, privateKey, publicKey };
}

export async function getBalance(account : string) : Promise<{ balance : number, pending : number }> {
    let { balance, pending } = await raiAction('account_balance', { account });
    
    [ balance, pending ] = await Promise.all([ rawToRai(balance), rawToRai(pending) ]);

    return { balance, pending };
}

export async function getPending(account : string) : Promise<Array<string>> {
    return (await raiAction('pending', {
        account,
        count:   '100'
    })).blocks;
}

export async function blockInfo(block : string) : Promise<{ amount : number, contents : { source : string }, block_account : string }> {
    let result = (await raiAction('blocks_info', {
        hashes: [ block ]
    })).blocks[block];

    result.amount = await rawToRai(result.amount);
    result.contents = JSON.parse(result.contents);

    return result;
}

export async function receive(wallet : string, account : string, block : string) : Promise<{}> {
    return await raiAction('receive', {
        wallet,
        account,
        block
    });
}

export async function destroyWallet(wallet : string) : Promise<void> {
    try {
        await raiAction('wallet_destroy', { wallet });
    } catch (err) {
        if (err.message === 'Wallet not found') {
            return;
        }
        throw err;
    }
}

export async function send(wallet : string, account : string, amount : number, destination : string) : Promise<{}> {
    return await raiAction('send', {
        wallet,
        source:      account,
        amount:      await raiToRaw(amount),
        destination
    });
}

export async function receiveAllPending(wallet : string, account : string) : Promise<{ balance : number, pending : number }> {
    let blocks = await getPending(account);

    for (let block of blocks) {
        await receive(wallet, account, block);
    }

    let { balance, pending } = await getBalance(account);

    return { balance, pending };
}

export async function accountHistory(account : string) : Promise<Array<{ hash : string, type : string, amount : string, account : string }>> {
    return (await raiAction('account_history', {
        account,
        count:   '100'
    })).history || [];
}

export async function getReceived(account : string) : Promise<Array<{ hash : string, type : string, amount : string, account : string }>> {
    let history = await accountHistory(account);
    return history.filter(entry => entry.type === 'receive');
}

export async function getSent(account : string) : Promise<Array<{ hash : string, type : string, amount : string, account : string }>> {
    let history = await accountHistory(account);
    return history.filter(entry => entry.type === 'send');
}

export async function getLastReceived(account : string) : Promise<{ hash : string, type : string, amount : string, account : string }> {
    return (await getReceived(account))[0];
}

export async function getLastSent(account : string) : Promise<{ hash : string, type : string, amount : string, account : string }> {
    return (await getSent(account))[0];
}

export async function getTotalReceived(account : string) : Promise<number> {
    let received = await getReceived(account);

    let blocks = [];

    for (let item of received) {
        if (blocks.indexOf(item.hash) === -1) {
            blocks.push(item.hash);
        }
    }

    let pending = await getPending(account);

    for (let hash of pending) {
        if (blocks.indexOf(hash) === -1) {
            blocks.push(hash);
        }
    }

    let totals = await Promise.all(blocks.map(async (block) => {
        let info = await blockInfo(block);
        return info.amount;
    }));

    let total = totals.reduce((a, b) => a + b, 0);

    return total;
}

export async function refundAccount(wallet : string, account : string) : Promise<void> {
    let { balance } = await receiveAllPending(wallet, account);

    if (!balance) {
        return;
    }

    let received = await getReceived(account);

    for (let transaction of received) {
        let refundAmount = Math.min(balance, await rawToRai(transaction.amount));
        await send(wallet, account, refundAmount, transaction.account);
        balance -= refundAmount;

        if (!balance) {
            break;
        }
    }
}

export async function getLatestSendBlock(account : string) : Promise<string | void> {
    let received = await getReceived(account);

    if (received.length) {
        let receiveBlock = received[received.length - 1].hash;
        let info = await blockInfo(receiveBlock);
        return info.contents.source;
    }

    let pending = await getPending(account);

    if (pending.length) {
        return pending[pending.length - 1];
    }
}

export async function getLatestTransaction(account : string) : Promise<{ send_block : string, sender : string }> {
    
    let send_block = await getLatestSendBlock(account);

    if (!send_block) {
        throw new Error(`No recent transactions found`);
    }

    let info = await blockInfo(send_block);
    let sender = info.block_account;

    return { send_block, sender };
}

export async function removeAccount(wallet : string, account : string) : Promise<void> {
    try {
        await raiAction('account_remove', { wallet, account });
    } catch (err) {
        if (err.message === 'Wallet not found') {
            return;
        }
        if (err.message === 'Account not found in wallet') {
            return;
        }
        throw err;
    }
}

export async function walletBalances(wallet : string) : Promise<{}> {
    let result = await raiAction('wallet_balances', { wallet });
    if (result && result.balance) {
        return result.balance;
    }
    return {};
}

export async function walletExists(wallet : string) : Promise<boolean> {
    try {
        await walletBalances(wallet);
        return true;
    } catch (err) {
        return false;
    }
}

export async function cleanupWallets() : Promise<void> {
    let wallets = await walletList();

    console.log('Cleaning addresses after 30 seconds');

    for (let { wallet, accounts } of wallets) {
        if (!accounts.length && await walletExists(wallet)) {
            if (!Object.keys(await walletBalances(wallet)).length) {
                await destroyWallet(wallet);
            }
        }
    }
}

type WaitForBalance = {
    account : string,
    amount : number,
    timeout? : number,
    delay? : number,
    onCancel : (Function) => void
};

export async function waitForBalance({ account, amount, timeout = 120000, delay = 5000, onCancel = noop } : WaitForBalance) : Promise<{ balance : number, pending : number }> {

    let start = Date.now();
    let cancelled = false;

    onCancel(() => {
        cancelled = true;
    });
    
    while (true) { // eslint-disable-line no-constant-condition
        await wait(delay);

        let elapsed = Date.now() - start;

        if (elapsed > (timeout / 2)) {
            delay *= 2;
        }

        let { balance, pending } = await getBalance(account);

        if ((balance + pending) >= amount) {
            return { balance, pending };
        }

        if (cancelled || elapsed > timeout) {
            break;
        }
    }

    return await getBalance(account);
}

export async function withPrivate<T>(privateKey : string, handler : ({ wallet : string, account : string }) => Promise<T> | T) : Promise<T> {
    let wallet = await walletCreate();
    let result = await raiAction('wallet_add', { wallet, key: privateKey });
    let account = result.account;

    let res;
    try {
        res = await handler({ wallet, account });
    } catch (err) {
        await destroyWallet(wallet);
        throw err;
    }
    
    await removeAccount(wallet, account);
    await destroyWallet(wallet);

    return res;
}


export async function recoverAndRefundAccount(privateKey : string) : Promise<void> {
    return await withPrivate(privateKey, async ({ wallet, account }) => {
        await refundAccount(wallet, account);
    });
}
