/* @flow */

import { join } from 'path';

import express from 'express';
import jwt from 'jsonwebtoken';
import base64 from 'base-64';

import { config, SUPPORTED_CURRENCIES } from './config';
import { waitForBalance, accountCreate, getTotalReceived, getLatestTransaction, accountHistory, isAccountValid } from './lib/rai';
import { handler, ValidationError } from './lib/util';
import { toRai } from './lib/coinmarketcap';
import { TRANSACTION_STATUS } from './constants';
import { createTransaction, getTransaction, setTransactionStatus, recoverAndRefundTransaction, recoverAndProcessTransaction } from './transaction';

const ROOT_DIR = join(__dirname, '..');

export let app = express();

app.use(express.urlencoded());
app.use('/static', express.static(`${ __dirname  }/../static`));

app.get('/', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/index.htm')));
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

    if (!destination.match(/^xrb_[a-z0-9]+$/)) {
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
    let token = base64.encode(jwt.sign({ id }, config.secret, { expiresIn: '1h' })).replace(/=/g, ''); // eslint-disable-line no-div-regex

    return { status: 'success', token, account, amount_rai };
}));

app.post('/api/session/:token/transfer', handler(async (req : express$Request, res) => {

    let { token } = req.params;

    // $FlowFixMe
    let { time = '120' } = req.body;

    token = token.replace(/=/g, ''); // eslint-disable-line no-div-regex
    time = Math.max(Math.min(parseInt(time, 10), 300), 120) * 1000;

    res.setTimeout(Math.floor(time * 1.5));

    // $FlowFixMe
    let { id } = jwt.verify(base64.decode(token), config.secret);
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

app.get('/api/session/:token/verify', handler(async (req : express$Request) => {

    let { token } = req.params;
    token = token.replace(/=/g, ''); // eslint-disable-line no-div-regex
    
    // $FlowFixMe
    let { id } = jwt.verify(base64.decode(token), config.secret);
    let { account, destination, amount, currency, amount_rai } = await getTransaction(id);

    let received_rai = Math.min(amount_rai, await getTotalReceived(account));
    let fulfilled = (received_rai === amount_rai);

    let response : Object = { token, destination, currency, amount, amount_rai, received_rai, fulfilled };

    if (fulfilled) {
        let { send_block, sender } = await getLatestTransaction(account);
        Object.assign(response, { send_block, sender });
    }

    return response;
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
