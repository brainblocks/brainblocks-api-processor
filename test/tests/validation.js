/* @flow */

import qs from 'qs'

import fetch from 'node-fetch';

import { URL } from '../config';
import { registerSingleNanoOperation } from '../mock';

test('Should fail a transaction when the nano node returns account invalid', async () => {

    let res = await fetch(URL);

    if (res.status !== 200) {
        throw new Error(`Expected 200 response, got ${ res.status }`);
    }

    let text = await res.text();

    if (!text) {
        throw new Error(`Should get html back from home page`);
    }

    registerSingleNanoOperation('validate_account_number', () => {
        return { valid: '0' };
    });

    res = await fetch(`${ URL }/api/session`, {
        method:  'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body:   qs.stringify({
            destination: 'xrb_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y',
            amount:      1
        })
    });

    let json = await res.json();

    if (json.status !== 'error') {
        throw new Error(`Expected status to be error, got ${ json.status }`);
    }
});
