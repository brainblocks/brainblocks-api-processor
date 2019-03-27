/* @flow */

export const PORT = 8000;
export const URL = `http://127.0.0.1:${ PORT }`;

export const NANO_PORT = 7076;
export const NANO_SERVER = `http://127.0.0.1:${ NANO_PORT }`;

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
        HOST:     process.env.DB_HOST || '127.0.0.1',
        NAME:     'brainblocks-test',
        USER:     process.env.CI ? 'root' : '',
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
    RAI_SERVER = 'http://127.0.0.1:7070';
} else {
    // Prod Processing Node Address
    RAI_SERVER = 'http://ssh.node2.brainblocks.io:7076';
}

export const PAYPAL_CLIENT = '***REMOVED***';
export const PAYPAL_SECRET = '***REMOVED***';

// url for connecting to distributed proof of work server
export const POW_URL = 'http://178.62.11.37:5000/work';
// api key for interacting with distributed proof of work server
export const POW_KEY = '8F17AFEB7851AA305091D436E2046025';

export const REPRESENTATIVE = 'xrb_1brainb3zz81wmhxndsbrjb94hx3fhr1fyydmg6iresyk76f3k7y7jiazoji';

export const EXCHANGE_WHITELIST = [
    'xrb_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k',
    'xrb_1niabkx3gbxit5j5yyqcpas71dkffggbr6zpd3heui8rpoocm5xqbdwq44oh',
    'xrb_1tig1rio7iskejqgy6ap75rima35f9mexjazdqqquthmyu48118jiewny7zo',
    'xrb_1k3irh88nf9pqec7pzpy6j46bewi36oct3quecciqajfeycpi1n4neecju7w',
    'xrb_18iofanfwdzqiq54aist741srnt7izcmmktgdub4iiwpgpzsuqjgkzmnahnq',
    'xrb_3rpc6f6ibeisa3cpn8j3x8jyxym5bp1mu4dswrqr17w4cnd5jepjqsjpaq3h',
    'xrb_1ejwssecquqhppb75mgf4wt4iunerirzksiq4pokdzqreyfzj5ecnksiisjm',
    'xrb_38fptyek1cybg1z64mdc9udj89uk4en4atig6ftzb9ui1xkemgtbzzfg8r85',
    'xrb_1zdpsyaxadcxfof81h9f37arkwnuyrngu33qm5ngj3mmptmjgrikykx38zfs',
    'xrb_1j4xxpxf36qzudexhm9peu1qkjo5ehx4srhibbhzmgewomxa7nodxf57rsju',
    'xrb_3azhmyaof9sdzboi8eghdw8fmmb5xke7zp6jcgu8p8ycasegpb1nookzenbs',
    'xrb_353wooh9ihduaj5auji6tgjt3n7iboh8uo1g7spkx3ome3xpxf7ctp8th4so',
    'xrb_1jorthzotgrsjs863m6srzx9ia8w8mue9xu8ath5izk7s6bdutgdczt73ft4',
    'xrb_3x7cjioqahgs5ppheys6prpqtb4rdknked83chf97bot1unrbdkaux37t31b'
];
