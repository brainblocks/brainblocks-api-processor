/* @flow */

export const PORT = 8000;
export const URL = `http://127.0.0.1:${ PORT }`;

export const NANO_PORT = 7076;
export const NANO_SERVER = `http://test.brainblocks.io:${ NANO_PORT }`;

export const SERVER_PORT = 8000;
export const SECRET = '***REMOVED***';

export let DATABASE;

if (process.env.NODE_ENV === 'development') {
    DATABASE = {
        HOST:     '127.0.0.1',
        NAME:     'brainblocks',
        USER:     '',
        PASSWORD: ''
    };
} else if (process.env.NODE_ENV === 'test') {
    DATABASE = {
        HOST:     '127.0.0.1',
        NAME:     'brainblocks-test',
        USER:     process.env.CI ? 'circleci' : '',
        PASSWORD: ''
    };
} else {
    DATABASE = {
        HOST:     'db.brainblocks.io',
        NAME:     'brainblocks',
        USER:     'brainblocks',
        PASSWORD: '***REMOVED***'
    };
}

export let RAI_SERVER;

if (process.env.NODE_ENV === 'development') {
    RAI_SERVER = 'http://127.0.0.1:7076';
} else if (process.env.NODE_ENV === 'test') {
    // RAI_SERVER = 'http://test.brainblocks.io:7076';
    RAI_SERVER = 'http://127.0.0.1:7070';
} else {
    // set to DigitalOcean Processing Node Private IP: 10.136.7.198
    // RAI_SERVER = 'http://ssh.node2.brainblocks.io:7076';
    RAI_SERVER = 'http://[10.136.7.198]:7076';
}

export const PAYPAL_CLIENT = '***REMOVED***';
export const PAYPAL_SECRET = '***REMOVED***';

export const REPRESENTATIVE = 'xrb_1brainb3zz81wmhxndsbrjb94hx3fhr1fyydmg6iresyk76f3k7y7jiazoji';
