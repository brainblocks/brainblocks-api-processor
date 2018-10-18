/* @flow */
/* global express$Request */
/* global express$Response */
/* global express$Application */

import express from 'express';
import uuidv4 from 'uuid/v4';

let nanoOperations = {};
let singleNanoOperations = {};

export function registerNanoOperation(name : string, handler : (Object) => mixed) {
    nanoOperations[name] = handler;
}

export function registerSingleNanoOperation(name : string, handler : (Object) => mixed) {
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

registerNanoOperation('rai_to_raw', ({ amount }) => {
    return {
        amount: `${ amount }000000000000000000000000`
    };
});


registerNanoOperation('account_history', () => {
    return [
        {
            hash:    uuidv4(),
            type:    'receive',
            amount:  '1000000000000000000000000',
            account: uuidv4()
        }
    ];
});

registerNanoOperation('pending', () => {
    return {
        blocks: [ uuidv4() ]
    };
});

registerNanoOperation('blocks_info', ({ hashes: [ block ] }) => {
    return {
        blocks: {
            [ block ]: {
                amount:        '1000000000000000000000000',
                block_account: uuidv4(),
                contents:      JSON.stringify({
                    source: uuidv4()
                })
            }
        }
    };
});
