/* @flow */

import { min } from 'big-integer';

import { TRANSACTION_STATUS, CURRENCY } from './constants';
import { EXCHANGE_WHITELIST } from './config';
import { postInsert, postSelectOne, postSelectID, postUpdateID } from './lib/postgres';
import { refundAccount, receiveAllPending, send, recoverAndRefundAccount, getSenders, getBalance, raiToRaw, rawToRai } from './lib/rai';
import type { BigInt } from './types';

const TRANSACTION_FIELDS = [ 'id', 'status', 'destination', 'amount', 'amount_rai', 'account', 'currency', 'private', 'public' ];

const PAYPAL_TRANSACTION_FIELDS = [ 'id', 'status', 'amount', 'currency', 'email', 'payment_id' ];

type TransactionInputType = {|
    status : string,
    destination : string,
    amount : string,
    amount_raw : BigInt,
    account : string,
    currency : string,
    privateKey : string,
    publicKey : string
|};

type TransactionType = {|
    id : string,
    status : string,
    destination : string,
    amount : string,
    amount_raw : BigInt,
    account : string,
    currency : string,
    privateKey : string,
    publicKey : string
|};

type PayPalTransactionType = {|
    id : string,
    status : string,
    amount : string,
    currency : string,
    email : string,
    payment_id : string
|};

type PublicPayPalTransactionType = {|
    status : string,
    amount : string,
    currency : string,
    email : string,
    payment_id : string
|};

export async function createTransaction({ status = TRANSACTION_STATUS.CREATED, destination, amount, amount_raw, account, currency, privateKey, publicKey } : TransactionInputType) : Promise<string> {
    let amount_rai = await rawToRai(amount_raw);
    let result = await postInsert('transaction', { status, destination, amount, amount_rai, wallet: 'XXXXXXX', account, currency, private: privateKey, public: publicKey });
    return result.id;
}

export async function createPayPalTransaction({ status = TRANSACTION_STATUS.CREATED, amount, currency, email, payment_id } : PublicPayPalTransactionType) : Promise<string> {
    let { id } = await postInsert('paypal_transaction', { status, amount, currency, email, payment_id  });
    return id;
}

export async function getTransaction(id : string) : Promise<TransactionType> {
    let { status, destination, amount, amount_rai, account, currency, private: privateKey, public: publicKey } = await postSelectID('transaction', id, TRANSACTION_FIELDS);
    let amount_raw = await raiToRaw(parseInt(amount_rai, 10));
    if (currency === 'rai') {
        currency = CURRENCY.NANO;
    }
    return { id, status, destination, amount, amount_raw, account, currency, privateKey, publicKey };
}

export async function getPayPalTransaction(id : string) : Promise<PayPalTransactionType> {
    let transaction = await postSelectID('paypal_transaction', id, PAYPAL_TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getTransactionByAccount(account : string) : Promise<TransactionType> {
    let { id, status, destination, amount, amount_rai, currency, private: privateKey, public: publicKey } = await postSelectOne('transaction', { account }, TRANSACTION_FIELDS);
    let amount_raw = await raiToRaw(parseInt(amount_rai, 10));
    if (currency === 'rai') {
        currency = CURRENCY.NANO;
    }
    return { id, status, destination, amount, amount_raw, account, currency, privateKey, publicKey };
}

export async function getTransactionByDestination(destination : string) : Promise<TransactionType> {
    let { id, status, account, amount, amount_rai, currency, private: privateKey, public: publicKey } = await postSelectOne('transaction', { destination }, TRANSACTION_FIELDS);
    let amount_raw = await raiToRaw(parseInt(amount_rai, 10));
    if (currency === 'rai') {
        currency = CURRENCY.NANO;
    }
    return { id, status, destination, amount, amount_raw, account, currency, privateKey, publicKey };
}

export async function setTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('transaction', id, { status });
}

export async function setPayPalTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('paypal_transaction', id, { status });
}

export async function processTransaction(id : string) : Promise<void> {
    let { privateKey, amount_raw, destination } = await getTransaction(id);

    await receiveAllPending(privateKey);
    await send(privateKey, amount_raw, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
}

export async function checkExchanges(id : string) : Promise<boolean> {
    let { privateKey } = await getTransaction(id);

    let senders = await getSenders(privateKey);

    let exchage = false;

    for (let sender of senders) {
        if (EXCHANGE_WHITELIST.includes(sender)) {
            exchage = true;
        }
    }

    return exchage;
}

export async function refundTransaction(id : string) : Promise<void> {
    let { privateKey, status } = await getTransaction(id);

    await refundAccount(privateKey);
    if (status !== TRANSACTION_STATUS.COMPLETE) {
        await setTransactionStatus(id, TRANSACTION_STATUS.REFUNDED);
    }
}

export async function recoverAndRefundTransaction(account : string) : Promise<void> {
    let { privateKey } = await getTransactionByAccount(account);
    await recoverAndRefundAccount(privateKey);
}

export async function forceProcessTransaction(id : string) : Promise<void> {
    let { privateKey, amount_raw, destination, account } = await getTransaction(id);

    await receiveAllPending(privateKey);

    let { balance } = await getBalance(account);
    let amountToProcess = min(balance, amount_raw);

    await send(privateKey, amountToProcess, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.FORCE);
}

export async function recoverAndProcessTransaction(account : string) : Promise<void> {
    let { id } = await getTransactionByAccount(account);
    await forceProcessTransaction(id);
}
