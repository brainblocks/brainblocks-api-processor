/* @flow */

export const SERVER_PORT = 8000;
//set to DigitalOcean Processing Node Private IP: 10.136.7.198
export const RAI_SERVER = 'http://[10.136.7.198]:7076';
export const SECRET = '***REMOVED***';

export let DATABASE;

if (process.env.NODE_ENV === 'development') {
    DATABASE = {
        HOST:     'localhost',
        NAME:     'brainblocks',
        USER:     '',
        PASSWORD: ''
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
        HOST:     'ip-172-31-6-166.us-east-2.compute.internal',
        NAME:     'brainblocks',
        USER:     'brainblocks',
        PASSWORD: '***REMOVED***'
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

export const REPRESENTATIVE = 'xrb_1brainb3zz81wmhxndsbrjb94hx3fhr1fyydmg6iresyk76f3k7y7jiazoji';
