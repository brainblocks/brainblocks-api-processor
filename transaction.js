
let { TRANSACTION_STATUS } = require('./constants');
let { postQuery, postQuerySingle, postInsert, postSelectOne, postSelectID, postUpdateID } = require('./lib/postgres');
let { refundAccount, removeAccount, receiveAllPending, send, recoverAndRefundAccount, recoverAndProcessAccount, withPrivate } = require('./lib/rai');

const TRANSACTION_FIELDS = [ 'id', 'status', 'destination', 'amount', 'amount_rai', 'account', 'currency', 'private', 'public' ];

async function createTransaction({ destination, amount, amount_rai, account, currency, privateKey, publicKey }) {
    let result = await postInsert('transaction', { status: TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, wallet: 'XXXXXXX', account, currency, private: privateKey, public: publicKey });
    return result.id;
}

async function getTransaction(id) {
    return await postSelectID('transaction', id, TRANSACTION_FIELDS);
}

async function getTransactionByAccount(account) {
    return await postSelectOne('transaction', { account }, TRANSACTION_FIELDS);
}

async function getTransactionByDestination(destination) {
    return await postSelectOne('transaction', { destination }, TRANSACTION_FIELDS);
}

async function setTransactionStatus(id, status) {
    return await postUpdateID('transaction', id, { status });
}

async function processTransaction(id) {
    let { private: privateKey, amount_rai, destination } = await getTransaction(id);

    await withPrivate(privateKey, async ({ wallet, account }) => {
        await receiveAllPending(wallet, account);
        await send(wallet, account, amount_rai, destination);
        await refundAccount(wallet, account);
        await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
    });
}

async function refundTransaction(id) {
    let { private: privateKey, status } = await getTransaction(id);

    await withPrivate(privateKey, async ({ wallet, account }) => {
        await refundAccount(wallet, account);
        if (status !== TRANSACTION_STATUS.COMPLETE) {
            await setTransactionStatus(id, TRANSACTION_STATUS.REFUNDED);
        }
    });
}

async function recoverAndRefundTransaction(account) {
    let { private: privateKey } = await getTransactionByAccount(account);
    await recoverAndRefundAccount(privateKey);
}

async function recoverAndProcessTransaction(account) {
    let { id } = await getTransactionByAccount(account);
    await processTransaction(id);
}

module.exports = { createTransaction, getTransaction, setTransactionStatus,
    processTransaction, refundTransaction, recoverAndRefundTransaction, recoverAndProcessTransaction };