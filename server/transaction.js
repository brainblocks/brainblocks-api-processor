/* @flow */

import { TRANSACTION_STATUS } from './constants';
import { postInsert, postSelectOne, postSelectID, postUpdateID } from './lib/postgres';
import { refundAccount, receiveAllPending, send, recoverAndRefundAccount } from './lib/rai';

const TRANSACTION_FIELDS = [ 'id', 'status', 'destination', 'amount', 'amount_rai', 'account', 'currency', 'private', 'public' ];

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

export async function createTransaction({ status = TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, account, currency, privateKey, publicKey } : PublicTransactionType) : Promise<string> {
    let result = await postInsert('transaction', { status, destination, amount, amount_rai, wallet: 'XXXXXXX', account, currency, private: privateKey, public: publicKey });
    return result.id;
}

export async function getTransaction(id : string) : Promise<TransactionType> {
    return await postSelectID('transaction', id, TRANSACTION_FIELDS);
}

export async function getTransactionByAccount(account : string) : Promise<TransactionType> {
    return await postSelectOne('transaction', { account }, TRANSACTION_FIELDS);
}

export async function getTransactionByDestination(destination : string) : Promise<TransactionType> {
    return await postSelectOne('transaction', { destination }, TRANSACTION_FIELDS);
}

export async function setTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('transaction', id, { status });
}

export async function processTransaction(id : string) : Promise<void> {
    let { private: privateKey, amount_rai, destination } = await getTransaction(id);

    await receiveAllPending(privateKey);
    await send(privateKey, amount_rai, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
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
