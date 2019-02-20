/* @flow */
/* eslint max-lines: 'off' */

import request from 'request-promise';
import { min } from 'big-integer';

import { RAI_SERVER, REPRESENTATIVE } from '../config';
import type { BigInt } from '../types';

import { wait, noop, buffer, eventEmitter, debounce, promise, toBigInt } from './util';

type Block = {
    type : string,
    account : string,
    previous : string,
    representative : string,
    balance : BigInt,
    link? : string,
    source? : string,
    link_as_account : string,
    signature : string,
    work : string
};

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
        // rai_node returns this error but process the command anyway?
        if (data.error !== 'Gap source block') {
            let err = new Error(data.error);

            // $FlowFixMe
            err.data = args;

            throw err;
        }
    }

    return data;
}

export async function raiToRaw(rai : number) : Promise<BigInt> {
    if (rai === 0) {
        return toBigInt('0');
    }

    let res = await raiAction('rai_to_raw', {
        amount: rai.toString()
    });

    return toBigInt(res.amount);
}

export async function rawToRai(raw : BigInt) : Promise<number> {
    if (raw.isZero()) {
        return 0;
    }

    let res = await raiAction('rai_from_raw', {
        amount: raw.toString()
    });

    return parseInt(res.amount, 10);
}

export async function accountHistory(account : string) : Promise<Array<{ hash : string, type : string, amount : BigInt, account : string }>> {

    let response = await raiAction('account_history', {
        account,
        count:   '100'
    });

    let history = response.history || [];

    return history.map(({ hash, type, amount, account: historyAccount }) => {
        return {
            hash,
            type,
            amount:  toBigInt(amount),
            account: historyAccount
        };
    });
}

export async function getReceived(account : string) : Promise<Array<{ hash : string, type : string, amount : BigInt, account : string }>> {
    let history = await accountHistory(account);
    return history.filter(
        entry => entry.type === 'receive'
    );
}

export async function getSent(account : string) : Promise<Array<{ hash : string, type : string, amount : BigInt, account : string }>> {
    let history = await accountHistory(account);
    return history.filter(
        entry => entry.type === 'send'
    );
}

export async function getLastReceived(account : string) : Promise<?{ hash : string, type : string, amount : BigInt, account : string }> {
    let received = await getReceived(account);
    return received[0];
}

export async function getLastSent(account : string) : Promise<?{ hash : string, type : string, amount : BigInt, account : string }> {
    let sent = await getSent(account);
    return sent[0];
}

export async function blockCreate({ type, key, account, representative, source } : { type : string, key : string, account : string, representative : string, source : string }) : Promise<{ hash : string, block : string }> {
    return await raiAction('block_create', { type, key, account, representative, source });
}

export async function getLatestBlock(account : string) : Promise<string> {
    let history = await accountHistory(account);
    return history && history[0] && history[0].hash;
}

export async function getAccountInfo(account : string) : Promise<{| balance : BigInt, frontier : string |}> {
    let { balance, frontier } = await raiAction('account_info', { account });

    return {
        frontier,
        balance: toBigInt(balance)
    };
}

export async function blockCreateSend({ key, account, destination, amount } : { key : string, account : string, destination : string, amount : BigInt }) :
    Promise<{ hash : string, block : Block }> {

    let res = await getAccountInfo(account);
    let { frontier, balance } = res;
    let newBalance = balance.subtract(amount);

    if (newBalance.isNegative()) {
        throw new Error(`Negative balance for send. Original balance: ${ balance.toString() } / Amount: ${ amount.toString() } / New Balance: ${ newBalance.toString() }`);
    }

    let { hash, block: serializedBlock } = await raiAction('block_create', {
        type:           'state',
        representative: REPRESENTATIVE,
        link:           destination,
        previous:       frontier,
        balance:        newBalance.toString(),
        key,
        account
    });

    const { type, account: blockAccount, previous, representative, balance: blockBalance,
        link, link_as_account, signature, work } = JSON.parse(serializedBlock);

    return {
        hash,
        block: {
            type,
            account: blockAccount,
            previous,
            representative,
            balance: toBigInt(blockBalance),
            link,
            link_as_account,
            signature,
            work
        }
    };
}

export async function blockCreateReceive({ key, account, source, amount } : { key : string, account : string, source : string, amount : BigInt }) :
    Promise<{ hash : string, block : Block }> {

    let previous = await getLatestBlock(account);

    let newBalance;

    if (previous) {
        let { balance } = await getAccountInfo(account);
        newBalance = balance.add(amount);
    } else {
        newBalance = amount;
        previous = '0';
    }

    let { hash, block: serializedBlock } = await raiAction('block_create', {
        type:           'state',
        representative: REPRESENTATIVE,
        link:           source,
        balance:        newBalance.toString(),
        previous,
        key,
        account
    });

    const { type, account: blockAccount, previous: blockPrevious,
        representative, balance: blockBalance, link, link_as_account, signature, work } = JSON.parse(serializedBlock);

    return {
        hash,
        block: {
            type,
            account:  blockAccount,
            previous: blockPrevious,
            balance:  toBigInt(blockBalance),
            representative,
            link,
            link_as_account,
            signature,
            work
        }
    };
}

export async function isAccountValid(account : string) : Promise<boolean> {
    let res = await raiAction('validate_account_number', { account });
    return res.valid === '1';
}

export let accountCreate = buffer(async () : Promise<{ account : string, privateKey : string, publicKey : string }> => {
    let { private: privateKey, public: publicKey, account } = await raiAction('key_create');
    return { account, privateKey, publicKey };
});

export async function getBalance(account : string) :
    Promise<{ balance : BigInt, pending : BigInt, total : BigInt }> {

    let { balance, pending } = await raiAction('account_balance', { account });

    return {
        balance: toBigInt(balance),
        pending: toBigInt(pending),
        total:   toBigInt(balance).add(toBigInt(pending))
    };
}

export async function getPending(account : string) : Promise<Array<string>> {
    let res = await raiAction('pending', {
        account,
        count:          '100',
        include_active: true
    });

    return res.blocks;
}

export async function blockInfo(block : string) :
    Promise<{ amount : BigInt, block_account : string, contents : Block }> {

    let res = await raiAction('blocks_info', {
        hashes: [ block ]
    });

    let { amount, contents: serializedContents, block_account } = res.blocks[block];
    let { type, account, previous, representative, balance, source, link_as_account, signature, work, link } = JSON.parse(serializedContents);

    return {
        amount:   toBigInt(amount),
        block_account,
        contents: {
            type,
            account,
            previous,
            representative,
            balance,
            source,
            link_as_account,
            signature,
            work,
            link
        }
    };
}

export async function keyExpand(key : string) : Promise<{ privateKey : string, publicKey : string, account : string }> {
    let { private: privateKey, public: publicKey, account } = await raiAction('key_expand', { key });

    return {
        privateKey,
        publicKey,
        account
    };
}

export async function keyToAccount(key : string) : Promise<string> {
    let { account } = await keyExpand(key);
    return account;
}

export async function process(block : Block) : Promise<string> {
    let serializedBlock = JSON.stringify(block);
    let { hash } = await raiAction('process', { block: serializedBlock });
    return hash;
}

export async function receive(key : string, sendBlock : string) : Promise<void> {

    let [ { amount }, account ] = await Promise.all([
        blockInfo(sendBlock),
        keyToAccount(key)
    ]);

    let { block: receiveBlock } = await blockCreateReceive({
        key,
        account,
        source:  sendBlock,
        amount
    });

    console.log(receiveBlock);
    await process(receiveBlock);
}

export async function getTotalReceived(account : string) : Promise<BigInt> {
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
        let { amount } = await blockInfo(block);
        return amount;
    }));

    let total = totals.reduce((a, b) => b.add(a), toBigInt('0'));

    return total;
}

export async function send(key : string, amount : BigInt, destination : string) : Promise<void> {

    let { block } = await blockCreateSend({
        key,
        destination,
        account:     await keyToAccount(key),
        amount
    });

    await process(block);
}

export async function receiveAllPending(key : string) : Promise<{ balance : BigInt, pending : BigInt }> {
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
        let refundAmount = min(balance, transaction.amount);
        let receiveBlock = await blockInfo(transaction.hash);
        let source = receiveBlock.contents.link || receiveBlock.contents.source;

        if (!source) {
            throw new Error(`Can not get source for receive block: ${ transaction.hash }`);
        }

        let sendBlock = await blockInfo(source);
        await send(key, refundAmount, sendBlock.contents.account);
        balance = balance.subtract(refundAmount);

        if (!balance) {
            break;
        }
    }
}

export async function getSenders(key : string) : Promise<Array<string>> {
    let { balance } = await receiveAllPending(key);

    if (!balance) {
        return [];
    }

    let account = await keyToAccount(key);
    let received = await getReceived(account);
    received.reverse();

    let senders = [];

    for (let transaction of received) {
        let receiveBlock = await blockInfo(transaction.hash);
        let source = receiveBlock.contents.link || receiveBlock.contents.source;

        if (!source) {
            throw new Error(`Can not get source for receive block: ${ transaction.hash }`);
        }

        let sendBlock = await blockInfo(source);
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
    nodeEventsActive = true;
};

let deactivateNodeEvents = debounce(() => {
    nodeEventsActive = false;
}, 30 * 1000);

nodeEvent.listen(() => {
    activateNodeEvents();
    deactivateNodeEvents();
});

type WaitForBalance = {|
    account : string,
    amount : BigInt,
    timeout? : number,
    delay? : number,
    onCancel : (Function) => void
|};

export async function waitForBalanceViaCallback({ account, amount, timeout = 120000, onCancel = noop } : WaitForBalance) :
    Promise<{ balance : BigInt, pending : BigInt, total : BigInt }> {

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

                    let { balance, pending, total } = await getBalance(account);

                    if (balance.add(pending).greaterOrEquals(amount)) {
                        clearTimeout(timeoutHandle);
                        listener.cancel();
                        resolve({ balance, pending, total });
                    }
                }
            });
        });

        onCancel(cancel);
    });
}

export async function waitForBalanceViaPoll({ account, amount, timeout = 120000, delay = 5000, onCancel = noop } : WaitForBalance) :
    Promise<{ balance : BigInt, pending : BigInt, total : BigInt }> {

    let start = Date.now();
    let cancelled = false;

    onCancel(() => {
        cancelled = true;
    });

    while (true) { // eslint-disable-line no-constant-condition
        let { balance, pending, total } = await getBalance(account);

        if (balance.add(pending).greaterOrEquals(amount)) {
            return { balance, pending, total };
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

export async function waitForBalance({ account, amount, timeout = 120000, delay = 5000, onCancel = noop } : WaitForBalance) :
    Promise<{ balance : BigInt, pending : BigInt, total : BigInt }> {

    if (nodeEventsActive) {
        return await waitForBalanceViaCallback({ account, amount, timeout, onCancel });
    } else {
        return await waitForBalanceViaPoll({ account, amount, timeout, delay, onCancel });
    }
}

export async function recoverAndRefundAccount(privateKey : string) : Promise<void> {
    await refundAccount(privateKey);
}
