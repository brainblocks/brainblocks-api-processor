
let { TRANSACTION_STATUS } = require('./constants');
let { postQuery, postQuerySingle, postInsert, postSelectID, postUpdateID } = require('./lib/postgres');
let { refundAccount, removeAccount, receiveAllPending, send } = require('./lib/rai');

async function createTransaction({ destination, amount, amount_rai, wallet, account, currency, private, public }) {
    let result = await postInsert('transaction', { status: TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, wallet, account, currency, private, public });
    return result.id;
}

async function getTransaction(id) {
    return await postSelectID('transaction', id, [ 'status', 'destination', 'amount', 'amount_rai', 'wallet', 'account', 'currency', 'private', 'public' ]);
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
    let { wallet, account } = await getTransaction(id);
    await refundAccount(wallet, account);
    await setTransactionStatus(id, TRANSACTION_STATUS.REFUNDED);
}

module.exports = { createTransaction, getTransaction, setTransactionStatus, processTransaction, refundTransaction };