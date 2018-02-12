
let { TRANSACTION_STATUS } = require('./constants');
let { postQuery, postQuerySingle, postInsert, postSelectOne, postSelectID, postUpdateID } = require('./lib/postgres');
let { refundAccount, removeAccount, receiveAllPending, send, recoverAndRefundAccount } = require('./lib/rai');

const TRANSACTION_FIELDS = [ 'status', 'destination', 'amount', 'amount_rai', 'wallet', 'account', 'currency', 'private', 'public' ];

async function createTransaction({ destination, amount, amount_rai, wallet, account, currency, private, public }) {
    let result = await postInsert('transaction', { status: TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, wallet, account, currency, private, public });
    return result.id;
}

async function getTransaction(id) {
    return await postSelectID('transaction', id, TRANSACTION_FIELDS);
}

async function getTransactionByAccount(account) {
    return await postSelectOne('transaction', { account }, TRANSACTION_FIELDS);
}

async function setTransactionStatus(id, status) {
    return await postUpdateID('transaction', id, { status });
}

async function processTransaction(id) {
    let { wallet, account, amount_rai, destination } = await getTransaction(id);
    await receiveAllPending(wallet, account);
    await send(wallet, account, amount_rai, destination);
    await refundAccount(wallet, account);
    await removeAccount(wallet, account);
    await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
}

async function refundTransaction(id) {
    let { wallet, account, status } = await getTransaction(id);
    await refundAccount(wallet, account);
    if (status !== TRANSACTION_STATUS.COMPLETE) {
        await setTransactionStatus(id, TRANSACTION_STATUS.REFUNDED);
    }
}

async function recoverAndRefundTransactionAccount(account) {
    let { private } = await getTransactionByAccount(account);
    await recoverAndRefundAccount(private);
}

module.exports = { createTransaction, getTransaction, setTransactionStatus, processTransaction, refundTransaction, recoverAndRefundTransactionAccount };