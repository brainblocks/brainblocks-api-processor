/* @flow */

import { TRANSACTION_STATUS } from './constants';
import { postInsert, postSelectOne, postSelectID, postUpdateID } from './lib/postgres';
import { refundAccount, receiveAllPending, send, recoverAndRefundAccount, getSenders } from './lib/rai';

const TRANSACTION_FIELDS = [ 'id', 'status', 'destination', 'amount', 'amount_rai', 'account', 'currency', 'private', 'public' ];

const PAYPAL_TRANSACTION_FIELDS = [ 'id', 'status', 'amount', 'currency', 'email', 'payment_id' ];

type TransactionType = {
    id : string,
    status : string,
    destination : string,
    amount : string,
    amount_rai : number,
    account : string,
    currency : string,
    private : string,
    public : string
};

type PublicTransactionType = {
    status : string,
    destination : string,
    amount : string,
    amount_rai : number,
    account : string,
    currency : string,
    privateKey : string,
    publicKey : string
};

type PayPalTransactionType = {
    id : string,
    status : string,
    amount : string,
    currency : string,
    email : string,
    payment_id : string
};

type PublicPayPalTransactionType = {
    status : string,
    amount : string,
    currency : string,
    email : string,
    payment_id : string
};

export async function createTransaction({ status = TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, account, currency, privateKey, publicKey } : PublicTransactionType) : Promise<string> {
    let result = await postInsert('transaction', { status, destination, amount, amount_rai, wallet: 'XXXXXXX', account, currency, private: privateKey, public: publicKey });
    return result.id;
}

export async function createPayPalTransaction({ status = TRANSACTION_STATUS.CREATED, amount, currency, email, payment_id } : PublicPayPalTransactionType) : Promise<string> {
    let result = await postInsert('paypal_transaction', { status, amount, currency, email, payment_id  });
    return result.id;
}

export async function getTransaction(id : string) : Promise<TransactionType> {
    let transaction = await postSelectID('transaction', id, TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getSendersForTransaction(id : string) : Promise<array> {
    let { private: privateKey } = await getTransaction(id);
    
    let senders = await getSenders(privateKey);

    return senders;
}

export async function getPayPalTransaction(id : string) : Promise<PayPalTransactionType> {
    let transaction = await postSelectID('paypal_transaction', id, PAYPAL_TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getTransactionByAccount(account : string) : Promise<TransactionType> {
    let transaction = await postSelectOne('transaction', { account }, TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getTransactionByDestination(destination : string) : Promise<TransactionType> {
    let transaction = await postSelectOne('transaction', { destination }, TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function setTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('transaction', id, { status });
}

export async function setPayPalTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('paypal_transaction', id, { status });
}

export async function processTransaction(id : string) : Promise<void> {
    let { private: privateKey, amount_rai, destination } = await getTransaction(id);

    await receiveAllPending(privateKey);
    await send(privateKey, amount_rai, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
}

export async function forceProcessTransaction(id : string) : Promise<void> {
    let { private: privateKey, amount_rai, destination } = await getTransaction(id);

    await receiveAllPending(privateKey);
    await send(privateKey, amount_rai, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.FORCE);
}

export async function checkExchanges(id : string) : Promise<boolean> {
    let { senders } = await getSendersForTransaction(id);

    let exchage = false;

    for (let sender of senders) {
        if (exchangeWhitelist.indexOf(sender) > -1) {
            exchage = true;
        }
    }

    return exchage;
}

export async function refundTransaction(id : string) : Promise<void> {
    let { private: privateKey, status } = await getTransaction(id);

    await refundAccount(privateKey);
    if (status !== TRANSACTION_STATUS.COMPLETE) {
        await setTransactionStatus(id, TRANSACTION_STATUS.REFUNDED);
    }
}

export async function recoverAndRefundTransaction(account : string) : Promise<void> {
    let { private: privateKey } = await getTransactionByAccount(account);
    await recoverAndRefundAccount(privateKey);
}

export async function recoverAndProcessTransaction(account : string) : Promise<void> {
    let { id } = await getTransactionByAccount(account);
    await processTransaction(id);
}
