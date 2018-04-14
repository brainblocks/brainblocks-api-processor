
module.exports.config = {
    server_port: 8000,
    rai_server:  'http://127.0.0.1:7076',
    secret:      '***REMOVED***'
};

module.exports.DATABASE = {
    HOST: 'localhost',
    NAME: 'brainblocks',
    USER: ''
};

/*
module.exports.DATABASE = {
    HOST:     'ip-172-31-6-166.us-east-2.compute.internal',
    NAME:     'brainblocks',
    USER:     'brainblocks',
    PASSWORD: '***REMOVED***'
};
*/

module.exports.SUPPORTED_CURRENCIES = [
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
