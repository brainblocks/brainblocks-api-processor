
let express = require('express');
let jwt = require('jsonwebtoken');
let uuidv4 = require('uuid/v4');
let base64 = require('base-64');

let { config, SUPPORTED_CURRENCIES } = require('./config');
let { waitForBalance, walletAccountCreate, getTotalReceived, send, receiveAllPending, refundAccount, destroyWallet } = require('./lib/rai');
let { handler, wait, ValidationError } = require('./lib/util');
let { subscribe, publish } = require('./lib/queue');
let { toRai } = require('./lib/coinmarketcap');
let { postQuery, postQuerySingle, postInsert, postSelectID, postUpdateID } = require('./lib/postgres');
let { TRANSACTION_STATUS, QUEUE } = require('./constants');
let { createTransaction, getTransaction, setTransactionStatus,
    processTransaction, refundTransaction } = require('./transaction');

let app = express();
app.use(express.urlencoded());
app.use('/static', express.static(__dirname + '/static'));

app.get('/', (req, res) => res.sendFile(__dirname + '/static/index.htm'));
app.get('/button', (req, res) => res.sendFile(__dirname + '/static/button.htm'));
app.get('/brainblocks.js', (req, res) => res.sendFile(__dirname + '/static/js/brainblocks.js'));
app.get('/brainblocks.min.js', (req, res) => res.sendFile(__dirname + '/static/js/brainblocks.min.js'));

subscribe(QUEUE.PROCESS_TRANSACTION, async (id) => {
    await processTransaction(id);
});

subscribe(QUEUE.REFUND_TRANSACTION, async (id) => {
    await wait(60 * 1000);
    await refundTransaction(id);
});

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
    let token = base64.encode(jwt.sign({ id }, config.secret, { expiresIn: '1h' }));

    return { status: 'success', token, account };
}));

app.post('/api/session/:token/transfer', handler(async (req, res) => {

    let { token } = req.params;
    let { id } = jwt.verify(base64.decode(token), config.secret);
    let { wallet, account, destination, amount_rai } = await getTransaction(id);

    await setTransactionStatus(id, TRANSACTION_STATUS.WAITING);

    let { balance, pending } = await waitForBalance(wallet, account, amount_rai);
    let received = balance + pending;

    if (received < amount_rai) {
        await setTransactionStatus(id, TRANSACTION_STATUS.EXPIRED);
        publish(QUEUE.REFUND_TRANSACTION, id);
        return { token, received, status: 'expired' };
    }

    await setTransactionStatus(id, TRANSACTION_STATUS.PENDING);
    publish(QUEUE.PROCESS_TRANSACTION, id);

    return { token, status: 'success' };
}));

app.get('/api/session/:token/verify', handler(async (req, res) => {

    let { token } = req.params;
    let { id } = jwt.verify(base64.decode(token), config.secret);
    let { account, destination, amount, currency, amount_rai } = await getTransaction(id);

    let received_rai = Math.min(amount_rai, await getTotalReceived(account));
    let fulfilled = (received_rai === amount_rai);

    return { token, destination, currency, amount, amount_rai, received_rai, fulfilled };
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

app.listen(config.server_port);
console.log(`brainblocks server listening on http://localhost:${ config.server_port }`);