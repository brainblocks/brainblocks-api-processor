/* @flow */

import qs from 'qs';
import fetch from 'node-fetch';

import { URL } from '../config';
import { registerSingleNanoOperation } from '../mock';

test('Should fail a transaction when the nano node returns destination invalid', async () => {

    registerSingleNanoOperation('validate_account_number', () => {
        return { valid: '0' };
    });

    let res = await fetch(`${ URL }/api/session`, {
        method:  'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body:   qs.stringify({
            destination: 'nano_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y',
            amount:      1
        })
    });

    let json = await res.json();

    if (json.status !== 'error') {
        throw new Error(`Expected status to be error, got ${ json.status }`);
    }
});

test('Should fail a transaction when the destination is not passed', async () => {

    let res = await fetch(`${ URL }/api/session`, {
        method:  'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body:   qs.stringify({
            amount: 1
        })
    });

    let json = await res.json();

    if (json.status !== 'error') {
        throw new Error(`Expected status to be error, got ${ json.status }`);
    }
});

test('Should fail a transaction when the destination is in an invalid format', async () => {

    let res = await fetch(`${ URL }/api/session`, {
        method:  'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body:   qs.stringify({
            destination: 'bitcoin_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y',
            amount:      1
        })
    });

    let json = await res.json();

    if (json.status !== 'error') {
        throw new Error(`Expected status to be error, got ${ json.status }`);
    }
});

test('Should fail a transaction when the amount is invalid', async () => {

    let res = await fetch(`${ URL }/api/session`, {
        method:  'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body:   qs.stringify({
            destination: 'nano_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y',
            amount:      '0.1'
        })
    });

    let json = await res.json();

    if (json.status !== 'error') {
        throw new Error(`Expected status to be error, got ${ json.status }`);
    }
});

test('Should fail a transaction when the amount is not passed', async () => {

    let res = await fetch(`${ URL }/api/session`, {
        method:  'post',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body:   qs.stringify({
            destination: 'nano_164xaa1ojy6qmq9e8t94mz8izr4mkf1sojb6xrmstru5jsif48g5kegcqg7y'
        })
    });

    let json = await res.json();

    if (json.status !== 'error') {
        throw new Error(`Expected status to be error, got ${ json.status }`);
    }
});
