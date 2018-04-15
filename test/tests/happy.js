/* @flow */

import qs from 'qs';
import fetch from 'node-fetch';

import { URL } from '../config';

// eslint-disable-next-line complexity
test('Should run a successful transaction', async () => {

    let res = await fetch(URL);

    if (res.status !== 200) {
        throw new Error(`Expected 200 response, got ${ res.status }`);
    }

    let text = await res.text();

    if (!text) {
        throw new Error(`Should get html back from home page`);
    }

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

    if (res.status !== 200) {
        throw new Error(`Expected 200 response, got ${ res.status }`);
    }

    let json = await res.json();

    if (json.status !== 'success') {
        throw new Error(`Expected status to be success, got ${ json.status }`);
    }

    if (!json.token) {
        throw new Error(`Expected token to be returned from api`);
    }

    if (!json.account) {
        throw new Error(`Expected account to be returned from api`);
    }

    if (!json.amount_rai) {
        throw new Error(`Expected amount_rai to be returned from api`);
    }

    res = await fetch(`${ URL }/api/session/${ json.token }/transfer`, {
        method:  'post'
    });

    if (res.status !== 200) {
        throw new Error(`Expected 200 response, got ${ res.status }`);
    }

    json = await res.json();

    if (json.status !== 'success') {
        throw new Error(`Expected status to be success, got ${ json.status }`);
    }

    if (!json.token) {
        throw new Error(`Expected token to be returned from api`);
    }

    res = await fetch(`${ URL }/api/session/${ json.token }/verify`);

    if (res.status !== 200) {
        throw new Error(`Expected 200 response, got ${ res.status }`);
    }

    json = await res.json();

    if (!json.token) {
        throw new Error(`Expected token to be returned from api`);
    }

    if (!json.destination) {
        throw new Error(`Expected destination to be returned from api`);
    }

    if (!json.currency) {
        throw new Error(`Expected currency to be returned from api`);
    }

    if (!json.amount) {
        throw new Error(`Expected amount to be returned from api`);
    }

    if (!json.amount_rai) {
        throw new Error(`Expected amount_rai to be returned from api`);
    }

    if (!json.received_rai) {
        throw new Error(`Expected received_rai to be returned from api`);
    }

    if (!json.fulfilled) {
        throw new Error(`Expected fulfilled to be returned from api`);
    }

    if (!json.send_block) {
        throw new Error(`Expected send_block to be returned from api`);
    }

    if (!json.sender) {
        throw new Error(`Expected sender to be returned from api`);
    }
});
