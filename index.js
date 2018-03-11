
let express = require('express');
let jwt = require('jsonwebtoken');
let uuidv4 = require('uuid/v4');
let base64 = require('base-64');

let { config, SUPPORTED_CURRENCIES } = require('./config');
let { waitForBalance, walletAccountCreate, getTotalReceived, send, receiveAllPending,
    refundAccount, destroyWallet, getLatestTransaction, accountHistory } = require('./lib/rai');
let { handler, wait, ValidationError } = require('./lib/util');
let { toRai } = require('./lib/coinmarketcap');
let { postQuery, postQuerySingle, postInsert, postSelectID, postUpdateID } = require('./lib/postgres');
let { TRANSACTION_STATUS, QUEUE } = require('./constants');
let { createTransaction, getTransaction, setTransactionStatus,
    processTransaction, refundTransaction, recoverAndRefundTransactionAccount } = require('./transaction');

let app = express();
app.use(express.urlencoded());
app.use('/static', express.static(__dirname + '/static'));

app.get('/', (req, res) => res.sendFile(__dirname + '/static/index.htm'));
app.get('/button', (req, res) => res.sendFile(__dirname + '/static/button.htm'));
app.get('/brainblocks.js', (req, res) => res.sendFile(__dirname + '/static/js/brainblocks.js'));
app.get('/brainblocks.min.js', (req, res) => res.sendFile(__dirname + '/static/js/brainblocks.min.js'));

app.post('/api/session', handler(async (req, res) => {

    let destination = req.body.destination;
    let amount      = req.body.amount;
    let currency    = req.body.currency || 'rai';

    if (!destination) {
        throw new ValidationError(`Expected 'destination' to be present in request body`);
    }

    if (!destination.match(/^xrb_[a-z0-9]+$/)) {
        throw new ValidationError(`Invalid destination: ${ destination }`)
    }

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) {
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    if (currency !== 'rai' && SUPPORTED_CURRENCIES.indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be rai or ${ SUPPORTED_CURRENCIES.join(', ') }, got ${ currency }`);
    }

    let amount_rai = (currency === 'rai')
        ? parseInt(amount)
        : await toRai(currency, amount);

    if (amount_rai < 1) {
        throw new ValidationError(`Expected rai amount to be greater than or equal to 1`);
    }
    
    let { wallet, account, private, public } = await walletAccountCreate();

    let id = await createTransaction({ destination, amount, amount_rai, wallet, account, currency, private, public });
    let token = base64.encode(jwt.sign({ id }, config.secret, { expiresIn: '1h' })).replace(/=/g, '');

    return { status: 'success', token, account, amount_rai };
}));

app.post('/api/session/:token/transfer', handler(async (req, res) => {

    let { token } = req.params;
    let { time = '120' } = req.body;

    token = token.replace(/=/g, '');
    time = Math.max(Math.min(parseInt(time), 300), 120) * 1000;

    res.setTimeout(Math.floor(time * 1.5));

    let { id } = jwt.verify(base64.decode(token), config.secret);
    let { wallet, account, destination, amount_rai } = await getTransaction(id);

    await setTransactionStatus(id, TRANSACTION_STATUS.WAITING);

    let { balance, pending } = await waitForBalance({
        wallet, 
        account, 
        amount: amount_rai, 
        timeout: time,
        onCancel: (handler) => req.connection.on('close', handler)
    });

    let received = balance + pending;

    if (received < amount_rai) {
        await setTransactionStatus(id, TRANSACTION_STATUS.EXPIRED);
        return { token, received, status: 'expired' };
    }

    await setTransactionStatus(id, TRANSACTION_STATUS.PENDING);
    return { token, status: 'success' };
}));

app.get('/api/session/:token/verify', handler(async (req, res) => {

    let { token } = req.params;
    token = token.replace(/=/g, '');
    
    let { id } = jwt.verify(base64.decode(token), config.secret);
    let { account, destination, amount, currency, amount_rai } = await getTransaction(id);

    let received_rai = Math.min(amount_rai, await getTotalReceived(account));
    let fulfilled = (received_rai === amount_rai);

    let response = { token, destination, currency, amount, amount_rai, received_rai, fulfilled };

    if (fulfilled) {
        let { send_block, sender } = await getLatestTransaction(account);
        Object.assign(response, { send_block, sender });
    };

    return response;
}));

app.get('/api/exchange/:currency/:amount/rai', handler(async (req, res) => {
    
    let { currency, amount } = req.params;

    if (SUPPORTED_CURRENCIES.indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be ${ SUPPORTED_CURRENCIES.join(', ') }, got ${ currency }`);
    }

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) {
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    let rai = await toRai(currency, amount);

    return {
        status: 'success',
        rai
    };
}));

app.get('/api/recover/:account', handler(async (req, res) => {
    
    let { account } = req.params;

    if (!account) {
        throw new Error(`Expected account`);
    }

    await recoverAndRefundTransactionAccount(account);

    return {
        status: 'success'
    }
}));

let server = app.listen(config.server_port);
console.log(`brainblocks server listening on http://localhost:${ config.server_port }`);