/* @flow */

import express from 'express';
import uuidv4 from 'uuid/v4';

let nanoOperations = {};
let singleNanoOperations = {};

export function registerNanoOperation(name : string, handler : (Object) => Object) {
    nanoOperations[name] = handler;
}

export function registerSingleNanoOperation(name : string, handler : (Object) => Object) {
    singleNanoOperations[name] = handler;
}

export function setupNanoMockServer() : express$Application {
    let app = express();
    app.use(express.json());

    app.post('/', async (req : express$Request, res : express$Response) => {

        // $FlowFixMe
        let action = req.body.action;
        let handler = singleNanoOperations[action] || nanoOperations[action];

        delete singleNanoOperations[action];

        if (!handler) {
            return res.status(200).json({ error: `Unregistered action: ${ action }` });
        }

        let result;

        try {
            result = await handler(req.body);
        } catch (err) {
            return res.status(500).json({ error: err.stack });
        }

        res.status(200).json(result);
    });

    return app;
}

registerNanoOperation('validate_account_number', ({ account }) => {
    if (!account.match(/^xrb_\w+$/)) {
        return { valid: '0' };
    }

    return { valid: '1' };
});

registerNanoOperation('key_create', () => {
    return {
        account: uuidv4(),
        public:  uuidv4(),
        private: uuidv4()
    };
});

registerNanoOperation('account_balance', () => {
    return {
        balance: '1000000000000000000000000',
        pending: '0'
    };
});

registerNanoOperation('rai_from_raw', ({ amount }) => {
    return {
        amount: parseInt(amount.replace(/000000000000000000000000$/, ''), 10)
    };
});
