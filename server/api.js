/* @flow */
/* global express$Request */
/* global express$Response */

import { join } from 'path';

import express from 'express';
import jwt from 'jsonwebtoken';
import base64 from 'base-64';
import fetch, { Headers } from 'node-fetch';

import { SECRET, SUPPORTED_CURRENCIES, PAYPAL_CLIENT, PAYPAL_SECRET } from './config';
import { waitForBalance, accountCreate, getTotalReceived, getLatestTransaction, accountHistory, isAccountValid, nodeEvent } from './lib/rai';
import { handler, ValidationError } from './lib/util';
import { toRai } from './lib/coinmarketcap';
import { TRANSACTION_STATUS } from './constants';
import { createTransaction, createPayPalTransaction, getTransaction, getPayPalTransaction,
    setTransactionStatus, recoverAndRefundTransaction, recoverAndProcessTransaction, setPayPalTransactionStatus } from './transaction';

const ROOT_DIR = join(__dirname, '..');

export let app = express();

app.use(express.urlencoded());
app.use(express.json());
app.use('/static', express.static(`${ __dirname  }/../static`));

app.get('/', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/index.htm')));
app.get('/blank', (req : express$Request, res : express$Response) => res.status(200).send(''));
app.get('/button', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/button.htm')));
app.get('/brainblocks.js', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/js/brainblocks.js')));
app.get('/brainblocks.min.js', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/js/brainblocks.min.js')));

app.post('/api/session', handler(async (req : express$Request) => {

    // $FlowFixMe
    let body : { destination? : string, amount? : string, currency? : string } = req.body;

    let destination = body.destination;
    let amount      = body.amount;
    let currency    = body.currency || 'rai';

    if (!destination) {
        throw new ValidationError(`Expected 'destination' to be present in request body`);
    }

    if (!destination.match(/((?:xrb_[13][a-km-zA-HJ-NP-Z0-9]{59})|(?:nano_[13][a-km-zA-HJ-NP-Z0-9]{59}))/)) {
        throw new ValidationError(`Invalid destination: ${ destination }`);
    }

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) { // eslint-disable-line security/detect-unsafe-regex
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    if (currency !== 'rai' && SUPPORTED_CURRENCIES.indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be rai or ${ SUPPORTED_CURRENCIES.join(', ') }, got ${ currency }`);
    }

    let amount_rai = (currency === 'rai')
        ? parseInt(amount, 10)
        : await toRai(currency, amount);

    if (amount_rai < 1) {
        throw new ValidationError(`Expected rai amount to be greater than or equal to 1`);
    }

    if (!await isAccountValid(destination)) {
        throw new ValidationError(`Destination account is invalid`);
    }

    let { account, privateKey, publicKey } = await accountCreate();

    let id = await createTransaction({ status: TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, account, currency, privateKey, publicKey });
    let token = base64.encode(jwt.sign({ type: 'nano', id }, SECRET, { expiresIn: '1h' })).replace(/=/g, ''); // eslint-disable-line no-div-regex

    return { status: 'success', token, account, amount_rai };
}));

app.post('/api/session/:token/transfer', handler(async (req : express$Request, res) => {

    let { token } = req.params;

    // $FlowFixMe
    let { time = '120' } = req.body;

    token = token.replace(/=/g, ''); // eslint-disable-line no-div-regex
    time = Math.max(Math.min(parseInt(time, 10), 1200), 120) * 1000;

    res.setTimeout(Math.floor(time * 1.5));

    // $FlowFixMe
    let { id } = jwt.verify(base64.decode(token), SECRET);
    let { account, amount_rai } = await getTransaction(id);

    await setTransactionStatus(id, TRANSACTION_STATUS.WAITING);

    let { balance, pending } = await waitForBalance({
        account,
        amount:   amount_rai,
        timeout:  time,
        onCancel: (cancelHandler) => req.connection.on('close', cancelHandler)
    });

    let received = balance + pending;

    if (received < amount_rai) {
        await setTransactionStatus(id, TRANSACTION_STATUS.EXPIRED);
        return { token, received, status: 'expired' };
    }

    await setTransactionStatus(id, TRANSACTION_STATUS.PENDING);
    return { token, status: 'success' };
}));

app.post('/api/paypal/session', handler(async (req : express$Request) => {

    // $FlowFixMe
    let { amount, currency, email, payment_id } = req.body;

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) { // eslint-disable-line security/detect-unsafe-regex
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    if (SUPPORTED_CURRENCIES.indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be one of ${ SUPPORTED_CURRENCIES.join(', ') }, got ${ currency }`);
    }

    let id = await createPayPalTransaction({ status: TRANSACTION_STATUS.CREATED, amount, currency, email, payment_id });
    let token = base64.encode(jwt.sign({ type: 'paypal', id }, SECRET, { expiresIn: '1h' })).replace(/=/g, ''); // eslint-disable-line no-div-regex

    return { status: 'success', token };
}));

app.post('/api/paypal/execute', handler(async (req : express$Request) => {

    // $FlowFixMe
    let { token, payer_id } = req.body;

    token = token.replace(/=/g, ''); // eslint-disable-line no-div-regex

    // $FlowFixMe
    let { id } = jwt.verify(base64.decode(token), SECRET);

    let { amount, currency, email, payment_id } = await getPayPalTransaction(id);

    let getPayment = await (await fetch(`https://api.paypal.com/v1/payments/payment/${ payment_id }`, {
        method:  'GET',
        headers: new Headers({
            'Content-type':  'application/json',
            'Authorization': `Basic ${ Buffer.from(`${ PAYPAL_CLIENT }:${ PAYPAL_SECRET }`).toString('base64') }`
        })
    })).json();

    if (getPayment.transactions[0].amount.total !== amount) {
        throw new Error(`Amount does not match paypal token`);
    }

    if (getPayment.transactions[0].amount.currency !== currency.toUpperCase()) {
        throw new Error(`Currency does not match paypal token`);
    }

    if (getPayment.transactions[0].payee.email !== email) {
        throw new Error(`Payee does not match paypal payee`);
    }

    let executePayment = await (await fetch(`https://api.paypal.com/v1/payments/payment/${ payment_id }/execute`, {
        method:  'POST',
        headers: new Headers({
            'Content-type':  'application/json',
            'Authorization': `Basic ${ Buffer.from(`${ PAYPAL_CLIENT }:${ PAYPAL_SECRET }`).toString('base64') }`
        }),
        body: JSON.stringify({
            payer_id
        })
    })).json();

    if (executePayment.state !== 'approved') {
        throw new Error(`Bad status: ${ executePayment.state }`);
    }

    await setPayPalTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);

    return { status: 'success' };
}));

app.get('/api/session/:token/verify', handler(async (req : express$Request) => {

    let { token } = req.params;
    token = token.replace(/=/g, ''); // eslint-disable-line no-div-regex

    // $FlowFixMe
    let { id, type = 'nano' } = jwt.verify(base64.decode(token), SECRET);

    if (type === 'paypal') {

        let { amount, currency, email, payment_id } = await getPayPalTransaction(id);

        let getPayment = await (await fetch(`https://api.paypal.com/v1/payments/payment/${ payment_id }`, {
            method:  'GET',
            headers: new Headers({
                'Content-type':  'application/json',
                'Authorization': `Basic ${ Buffer.from(`${ PAYPAL_CLIENT }:${ PAYPAL_SECRET }`).toString('base64') }`
            })
        })).json();
    
        if (getPayment.transactions[0].amount.total !== amount) {
            throw new Error(`Amount does not match paypal token`);
        }
    
        if (getPayment.transactions[0].amount.currency !== currency.toUpperCase()) {
            throw new Error(`Currency does not match paypal token`);
        }
    
        if (getPayment.transactions[0].payee.email !== email) {
            throw new Error(`Payee does not match paypal payee`);
        }

        let fulfilled = (getPayment.state === 'approved');

        return {
            type,
            token,
            currency,
            amount,
            email,
            fulfilled
        };

    } else if (type === 'nano') {

        let { account, destination, amount, currency, amount_rai } = await getTransaction(id);

        let received_rai = Math.min(amount_rai, await getTotalReceived(account));
        let fulfilled = (received_rai === amount_rai);
    
        let response : Object = { type, token, destination, currency, amount, amount_rai, received_rai, fulfilled };
    
        if (fulfilled) {
            let { send_block, sender } = await getLatestTransaction(account);
            Object.assign(response, { send_block, sender });
        }
    
        return response;
    } else {
        throw new Error(`Unrecognized type: ${ type }`);
    }
}));


app.get('/api/exchange/:currency/:amount/rai', handler(async (req : express$Request) => {

    let { currency, amount } = req.params;

    if (SUPPORTED_CURRENCIES.indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be ${ SUPPORTED_CURRENCIES.join(', ') }, got ${ currency }`);
    }

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) { // eslint-disable-line security/detect-unsafe-regex
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    let rai = await toRai(currency, amount);

    return {
        status: 'success',
        rai
    };
}));

app.get('/api/refund/:account', handler(async (req : express$Request) => {

    let { account } = req.params;

    if (!account) {
        throw new ValidationError(`Expected account`);
    }

    await accountHistory(account);

    await recoverAndRefundTransaction(account);

    return {
        status: 'success'
    };
}));

app.get('/api/process/:account', handler(async (req : express$Request) => {

    let { account } = req.params;

    if (!account) {
        throw new ValidationError(`Expected account`);
    }

    await accountHistory(account);

    await recoverAndProcessTransaction(account);

    return {
        status: 'success'
    };
}));

function mapCallbackData(data : mixed) : { hash : string, block : { link_as_account : string } } {

    // $FlowFixMe
    let { hash, block } = data;

    if (!hash) {
        throw new Error(`Expected body.hash`);
    }

    if (!block) {
        throw new Error(`Expected body.hash`);
    }

    block = JSON.parse(block);

    return { hash, block };
}

app.all('/nano/callback', handler(async (req : express$Request) => {

    let data = mapCallbackData(req.body);

    nodeEvent.publish(data);

    return await {
        status: 'success'
    };
}, { log: false }));
