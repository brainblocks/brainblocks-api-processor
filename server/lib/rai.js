/* @flow */

import request from 'request-promise';
import bigInt from 'big-integer';

import { RAI_SERVER, REPRESENTATIVE } from '../config';

import { wait, noop, buffer, eventEmitter, debounce, promise } from './util';

export async function raiAction<R : Object>(action : string, args : Object = {}) : Promise<R> {

    console.log((new Date()).toUTCString(), 'START', action, args);

    let res;

    try {
        res = await request({
            method:  'POST',
            uri:     RAI_SERVER,
            headers: {
                'content-type': 'application/json'
            },
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
            uri:    RAI_SERVER,
            body:   JSON.stringify({
                action,
                ...args
            }),
            resolveWithFullResponse: true
        });
    }

    console.log((new Date()).toUTCString(), 'COMPLETE', action, args, res.body);

    if (res.statusCode !== 200) {
        throw new Error(`Expected status to be 200, got ${ res.statusCode } for action: ${ action }`);
    }
    
    let data = JSON.parse(res.body);

    if (data.error) {
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

export async function blockCreate({ type, key, account, representative, source } : { type : string, key : string, account : string, representative : string, source : string }) : Promise<{ hash : string, block : string }> {
    return await raiAction('block_create', { type, key, account, representative, source });
}

export async function getLatestBlock(account : string) : Promise<string> {
    let history = await accountHistory(account);
    return history && history[0] && history[0].hash;
}

export async function getAccountInfo(account : string) : Promise<{ balance : string, frontier : string }> {
    return await raiAction('account_info', { account });
}

export async function blockCreateSend({ key, account, destination, amount } : { key : string, account : string, destination : string, amount : string }) : Promise<{ hash : string, block : string }> {

    let { frontier, balance } = await getAccountInfo(account);
    let newBalance = bigInt(balance).subtract(amount).toString();

    let { hash, block } = await raiAction('block_create', {
        type:           'state',
        representative: REPRESENTATIVE,
        link:           destination,
        previous:       frontier,
        balance:        newBalance,
        key,
        account
    });

    block = JSON.parse(block);
    return { hash, block };
}

export async function blockCreateReceive({ key, account, source, amount } : { key : string, account : string, source : string, amount : string }) : Promise<{ hash : string, block : string }> {
    let previous = await getLatestBlock(account);

    let newBalance;

    if (previous) {
        let { balance } = await getAccountInfo(account);
        newBalance = bigInt(balance).add(amount).toString();
    } else {
        newBalance = amount;
        previous = '0';
    }

    let { hash, block } = await raiAction('block_create', {
        type:           'state',
        representative: REPRESENTATIVE,
        link:           source,
        balance:        newBalance,
        previous,
        key,
        account
    });

    block = JSON.parse(block);

    return { hash, block };
}

export async function isAccountValid(account : string) : Promise<boolean> {
    return (await raiAction('validate_account_number', { account })).valid === '1';
}

export let accountCreate = buffer(async () : Promise<{ account : string, privateKey : string, publicKey : string }> => {
    let { private: privateKey, public: publicKey, account } = await raiAction('key_create');
    return { account, privateKey, publicKey };
});

export async function getRawBalance(account : string) : Promise<{ balance : string, pending : string }> {
    let { balance, pending } = await raiAction('account_balance', { account });
    return { balance, pending };
}


export async function getBalance(account : string) : Promise<{ balance : number, pending : number }> {
    let { balance, pending } = await getRawBalance(account);
    
    [ balance, pending ] = await Promise.all([ rawToRai(balance), rawToRai(pending) ]);

    return { balance, pending };
}

export async function getPending(account : string) : Promise<Array<string>> {
    return (await raiAction('pending', {
        account,
        count:   '100'
    })).blocks;
}

export async function blockInfo(block : string) : Promise<{ amount : number, contents : { source : string, link_as_account : string, link : string, account : string }, block_account : string }> {
    let result = (await raiAction('blocks_info', {
        hashes: [ block ]
    })).blocks[block];

    result.amount = await rawToRai(result.amount);
    result.contents = JSON.parse(result.contents);

    return result;
}

export async function keyExpand(key : string) : Promise<{ private : string, public : string, account : string }> {
    return await raiAction('key_expand', { key });
}

export async function keyToAccount(key : string) : Promise<string> {
    let { account } = await keyExpand(key);
    return account;
}

export async function process(block : string) : Promise<string> {
    block = JSON.stringify(block);
    let { hash } = await raiAction('process', { block });
    return hash;
}

export async function receive(key : string, sendBlock : string) : Promise<void> {
    let info = (await raiAction('blocks_info', {
        hashes: [ sendBlock ]
    })).blocks[sendBlock];

    let { block: receiveBlock } = await blockCreateReceive({
        key,
        account: await keyToAccount(key),
        source:  sendBlock,
        amount:  info.amount
    });

    await process(receiveBlock);
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

export async function send(key : string, amount : number, destination : string) : Promise<void> {

    let { block } = await blockCreateSend({
        key,
        destination,
        account:     await keyToAccount(key),
        amount:      await raiToRaw(amount)
    });

    await process(block);
}

export async function receiveAllPending(key : string) : Promise<{ balance : number, pending : number }> {
    let account = await keyToAccount(key);
    let blocks = await getPending(account);

    for (let block of blocks) {
        await receive(key, block);
    }

    let { balance, pending } = await getBalance(account);
    return { balance, pending };
}

export async function refundAccount(key : string) : Promise<void> {
    let { balance } = await receiveAllPending(key);

    if (!balance) {
        return;
    }

    let account = await keyToAccount(key);
    let received = await getReceived(account);
    received.reverse();

    for (let transaction of received) {
        let refundAmount = Math.min(balance, await rawToRai(transaction.amount));
        let receiveBlock = await blockInfo(transaction.hash);
        let sendBlock = await blockInfo(receiveBlock.contents.link);
        await send(key, refundAmount, sendBlock.contents.account);
        balance -= refundAmount;

        if (!balance) {
            break;
        }
    }
}

export async function getSenders(key : string) : Promise<Array<string>> {
    let { balance } = await receiveAllPending(key);

    if (!balance) {
        return [ '' ];
    }

    let account = await keyToAccount(key);
    let received = await getReceived(account);
    received.reverse();

    let senders = [];

    for (let transaction of received) {
        let receiveBlock = await blockInfo(transaction.hash);
        let sendBlock = await blockInfo(receiveBlock.contents.link);
        
        senders.push(sendBlock.contents.account);
    }

    return senders;
}

export async function getLatestSendBlock(account : string) : Promise<string | void> {
    let received = await getReceived(account);

    if (received.length) {
        let receiveBlock = received[received.length - 1].hash;
        let info = await blockInfo(receiveBlock);
        let source = info.contents.link || info.contents.source;
        if (!source) {
            throw new Error(`Can not find source in send block: ${ JSON.stringify(info.contents) }`);
        }
        return source;
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

export let nodeEvent = eventEmitter();

let nodeEventsActive = false;

let activateNodeEvents = () => {
    // nodeEventsActive = true;
};

let deactivateNodeEvents = debounce(() => {
    nodeEventsActive = false;
}, 30 * 1000);

nodeEvent.listen(() => {
    activateNodeEvents();
    deactivateNodeEvents();
});

type WaitForBalance = {
    account : string,
    amount : number,
    timeout? : number,
    delay? : number,
    onCancel : (Function) => void
};

export async function waitForBalanceViaCallback({ account, amount, timeout = 120000, onCancel = noop } : WaitForBalance) : Promise<{ balance : number, pending : number }> {
    return await promise(({ resolve, run }) => {
        let timeoutHandle;
        let listener;

        let cancel = async () => {
            clearTimeout(timeoutHandle);
            listener.cancel();
            resolve(await getBalance(account));
        };

        timeoutHandle = setTimeout(cancel, timeout);

        listener = nodeEvent.listen(data => {
            run(async () => {
                if (data.block.link_as_account === account) {
                    let block = await blockInfo(data.hash);
    
                    if (block.contents.link_as_account !== account) {
                        throw new Error(`Callback account does not match`);
                    }
    
                    let { balance, pending } = await getBalance(account);
    
                    if ((balance + pending) >= amount) {
                        clearTimeout(timeoutHandle);
                        listener.cancel();
                        resolve({ balance, pending });
                    }
                }
            });
        });

        onCancel(cancel);
    });
}

export async function waitForBalanceViaPoll({ account, amount, timeout = 120000, delay = 5000, onCancel = noop } : WaitForBalance) : Promise<{ balance : number, pending : number }> {

    let start = Date.now();
    let cancelled = false;

    onCancel(() => {
        cancelled = true;
    });
    
    while (true) { // eslint-disable-line no-constant-condition
        let { balance, pending } = await getBalance(account);

        if ((balance + pending) >= amount) {
            return { balance, pending };
        }

        let elapsed = Date.now() - start;

        if (cancelled || elapsed > timeout) {
            break;
        }

        await wait(delay);

        if (elapsed > (timeout / 2)) {
            delay *= 2;
        }
    }

    return await getBalance(account);
}

export async function waitForBalance({ account, amount, timeout = 120000, delay = 5000, onCancel = noop } : WaitForBalance) : Promise<{ balance : number, pending : number }> {
    if (nodeEventsActive) {
        return await waitForBalanceViaCallback({ account, amount, timeout, onCancel });
    } else {
        return await waitForBalanceViaPoll({ account, amount, timeout, delay, onCancel });
    }
}

export async function recoverAndRefundAccount(privateKey : string) : Promise<void> {
    await refundAccount(privateKey);
}
