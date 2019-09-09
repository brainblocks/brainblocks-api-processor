/* @flow */
/* global express$Request */
/* global express$Response */

import { join } from 'path';

import express from 'express';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import base64 from 'base-64';
import fetch, { Headers } from 'node-fetch';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { min } from 'big-integer';

import { SECRET, PAYPAL_CLIENT, PAYPAL_SECRET, NANO_SERVER, NANO_WS } from './config';
import { waitForBalance, getTotalReceived, getLatestTransaction, accountHistory, isAccountValid, nodeEvent, rawToRai, representativesOnline } from './lib/rai';
import { getAccount } from './lib/precache';
import { handler, ValidationError } from './lib/util';
import { currencyToRaw, pullRates } from './lib/rateService';
import { TRANSACTION_STATUS, CURRENCY } from './constants';
import { createTransaction, createPayPalTransaction, getTransaction, getPayPalTransaction,
    setTransactionStatus, recoverAndRefundTransaction, recoverAndProcessTransaction, setPayPalTransactionStatus,
    processTransaction, forceProcessTransaction, checkExchanges } from './transaction';

const ROOT_DIR = join(__dirname, '..');
const swaggerDocument = YAML.load(join(ROOT_DIR, 'server/swagger.yaml'));

// websocket connection
const socketConnection = `ws://${ NANO_SERVER }:${ NANO_WS }`;
let nodeSocket = new WebSocket(socketConnection);

export let app = express();

app.use(express.urlencoded());
app.use(express.json());
app.use('/static', express.static(`${ __dirname  }/../static`));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
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
    let currency    = body.currency || CURRENCY.NANO;

    if (currency === 'rai') {
        currency = CURRENCY.NANO;
    }

    if (!destination) {
        throw new ValidationError(`Expected 'destination' to be present in request body`);
    }

    if (!destination.match(/((?:xrb_[13][a-km-zA-HJ-NP-Z0-9]{59})|(?:nano_[13][a-km-zA-HJ-NP-Z0-9]{59}))/)) {
        throw new ValidationError(`Invalid destination: ${ destination }`);
    }

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) { // eslint-disable-line security/detect-unsafe-regex
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    if (Object.values(CURRENCY).indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be rai or ${ Object.values(CURRENCY).join(', ') }, got ${ currency }`);
    }

    let amount_raw = await currencyToRaw(currency, amount);
    let amount_rai = await rawToRai(amount_raw);

    if (amount_rai < 1) {
        throw new ValidationError(`Expected rai amount to be greater than or equal to 1`);
    }

    if (!await isAccountValid(destination)) {
        throw new ValidationError(`Destination account is invalid`);
    }

    let { account, privateKey, publicKey } = await getAccount();

    let id = await createTransaction({ status: TRANSACTION_STATUS.CREATED, destination, amount, amount_raw, account, currency, privateKey, publicKey });
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
    let { account, amount_raw } = await getTransaction(id);

    await setTransactionStatus(id, TRANSACTION_STATUS.WAITING);

    let { total } = await waitForBalance({
        account,
        amount:   amount_raw,
        timeout:  time,
        // $FlowFixMe
        onCancel: (cancelHandler) => req.connection.on('close', cancelHandler)
    });

    if (total.lesser(amount_raw)) {
        await setTransactionStatus(id, TRANSACTION_STATUS.EXPIRED);
        return {
            token,
            received: await rawToRai(total),
            status:   'expired'
        };
    }

    await setTransactionStatus(id, TRANSACTION_STATUS.PENDING);

    if (await checkExchanges(id)) {
        await forceProcessTransaction(id);
    } else {
        await processTransaction(id);
    }

    return { token, status: 'success' };
}));

app.post('/api/paypal/session', handler(async (req : express$Request) => {

    // $FlowFixMe
    let { amount, currency, email, payment_id } = req.body;

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) { // eslint-disable-line security/detect-unsafe-regex
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    if (Object.values(CURRENCY).indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be one of ${ Object.values(CURRENCY).join(', ') }, got ${ currency }`);
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

        let { account, destination, amount, currency, amount_raw } = await getTransaction(id);

        let received_raw = min(amount_raw, await getTotalReceived(account));
        let fulfilled = (received_raw.equals(amount_raw));

        if (currency === CURRENCY.NANO) {
            currency = 'rai';
        }

        let response : Object = {
            type,
            token,
            destination,
            currency,
            amount,
            amount_rai:   await rawToRai(amount_raw),
            received_rai: await rawToRai(received_raw),
            fulfilled
        };

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

    if (Object.values(CURRENCY).indexOf(currency) === -1) {
        throw new ValidationError(`Expected currency to be ${ Object.values(CURRENCY).join(', ') }, got ${ currency }`);
    }

    if (!amount || !amount.match(/^\d+(\.\d+)?$/)) { // eslint-disable-line security/detect-unsafe-regex
        throw new ValidationError(`Expected amount to be a number, got ${ amount }`);
    }

    let amount_raw = await currencyToRaw(currency, amount);
    let amount_rai = await rawToRai(amount_raw);

    return {
        status: 'success',
        rai:    amount_rai
    };
}));

app.get('/api/exchange/rates', handler(async () => {

    const prices = await pullRates();

    return {
        status: 'success',
        rates:  prices
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

// provide node monitor endpoint for uptimerobot to alert us
app.get('/api/nano/node/representatives/check/:rep', handler(async (req : express$Request) => {

    let { rep } = req.params;
    const representatives = await representativesOnline();

    if (representatives.includes(rep)) {
        return {
            status: 'success'
        };
    } else {
        return {
            status: 'error'
        };
    }
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

    return { hash, block };
}

nodeSocket.on('open', () => {
    console.log('Node Socket - connected');
    let subscribe = JSON.stringify({ 'action': 'subscribe', 'topic': 'confirmation' });
    nodeSocket.send(subscribe);
});

nodeSocket.on('close', () => {
    console.log('Node Socket - disconnected');
});

nodeSocket.on('message', async message => {
    let fullPacket = JSON.parse(message);
    let fullMessage = fullPacket.message;
    let fullBlock = fullMessage.block;

    /* All block types
      if (fullBlock.block.type === 'state') {
          if (fullBlock.is_send === 'true' && fullBlock.block.link_as_account) {
              destinations.push(fullBlock.block.link_as_account);
          }
          // push to destinations array
          destinations.push(fullBlock.account);
      } else {
          // push to destinations array
          destinations.push(fullBlock.block.destination);
      }
    */

    /* For now, only sends where we are the recipient */
    if (fullBlock.type !== 'state' || fullBlock.subtype !== 'send') {
        return;
    }

    let data = await mapCallbackData(fullMessage);
    nodeEvent.publish(data);
});
