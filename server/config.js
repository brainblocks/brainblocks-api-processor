/* @flow */

export const SERVER_PORT = 8000;
export const RAI_SERVER = 'http://127.0.0.1:7076';
export const SECRET = '***REMOVED***';

export let DATABASE;

if (process.env.NODE_ENV === 'production') {
    DATABASE = {
        HOST:     'ip-172-31-6-166.us-east-2.compute.internal',
        NAME:     'brainblocks',
        USER:     'brainblocks',
        PASSWORD: '***REMOVED***'
    };
} else if (process.env.NODE_ENV === 'test') {
    DATABASE = {
        HOST:     'localhost',
        NAME:     'brainblocks-test',
        USER:     '',
        PASSWORD: ''
    };
} else {
    DATABASE = {
        HOST:     'localhost',
        NAME:     'brainblocks',
        USER:     '',
        PASSWORD: ''
    };
}


export const SUPPORTED_CURRENCIES = [
    'aud',
    'brl',
    'cad',
    'chf',
    'clp',
    'cny',
    'czk',
    'dkk',
    'eur',
    'gbp',
    'hkd',
    'huf',
    'idr',
    'ils',
    'inr',
    'jpy',
    'krw',
    'mxn',
    'myr',
    'nok',
    'nzd',
    'php',
    'pkr',
    'pln',
    'rub',
    'sek',
    'sgd',
    'thb',
    'try',
    'usd',
    'twd',
    'zar'
];
