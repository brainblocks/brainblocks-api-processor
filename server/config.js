/* @flow */

export const PORT = 8000;
export const URL = `http://127.0.0.1:${ PORT }`;

export const NANO_PORT = 7076;
export const NANO_WS = 7078;
export const NANO_SERVER = 'ssh.node2.brainblocks.io';
export let NANO_RPC;

export const SERVER_PORT = 8000;
export const SECRET = '***REMOVED***';

export let DATABASE;

if (process.env.NODE_ENV === 'development') {
    DATABASE = {
        HOST:     '127.0.0.1',
        NAME:     'brainblocks',
        USER:     '',
        PASSWORD: '',
        PORT:     5432
    };
} else if (process.env.NODE_ENV === 'test') {
    DATABASE = {
        HOST:     process.env.CI ? process.env.DB_HOST : '127.0.0.1',
        NAME:     'brainblocks-test',
        USER:     process.env.CI ? 'root' : '',
        PASSWORD: '',
        PORT:     5432
    };
} else {
    DATABASE = {
        HOST:     'db.brainblocks.io',
        NAME:     'brainblocks',
        USER:     'brainblocks',
        PASSWORD: '***REMOVED***',
        PORT:     25060
    };
}

if (process.env.NODE_ENV === 'development') {
    // Development Node RPC
    NANO_RPC = `http://127.0.0.1:${ NANO_PORT }`;
} else if (process.env.NODE_ENV === 'test') {
    // Test Node RPC
    NANO_RPC = `http://127.0.0.1${ NANO_PORT }`;
} else {
    // Production Processing Node Address
    NANO_RPC = `http://${ NANO_SERVER }:${ NANO_PORT }`;
}

export const PAYPAL_CLIENT = '***REMOVED***';
export const PAYPAL_SECRET = '***REMOVED***';

export const REPRESENTATIVE = 'nano_1brainb3zz81wmhxndsbrjb94hx3fhr1fyydmg6iresyk76f3k7y7jiazoji';

export const EXCHANGE_WHITELIST = [
    'nano_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k',
    'nano_1niabkx3gbxit5j5yyqcpas71dkffggbr6zpd3heui8rpoocm5xqbdwq44oh',
    'nano_1tig1rio7iskejqgy6ap75rima35f9mexjazdqqquthmyu48118jiewny7zo',
    'nano_1k3irh88nf9pqec7pzpy6j46bewi36oct3quecciqajfeycpi1n4neecju7w',
    'nano_18iofanfwdzqiq54aist741srnt7izcmmktgdub4iiwpgpzsuqjgkzmnahnq',
    'nano_3rpc6f6ibeisa3cpn8j3x8jyxym5bp1mu4dswrqr17w4cnd5jepjqsjpaq3h',
    'nano_1ejwssecquqhppb75mgf4wt4iunerirzksiq4pokdzqreyfzj5ecnksiisjm',
    'nano_38fptyek1cybg1z64mdc9udj89uk4en4atig6ftzb9ui1xkemgtbzzfg8r85',
    'nano_1zdpsyaxadcxfof81h9f37arkwnuyrngu33qm5ngj3mmptmjgrikykx38zfs',
    'nano_1j4xxpxf36qzudexhm9peu1qkjo5ehx4srhibbhzmgewomxa7nodxf57rsju',
    'nano_3azhmyaof9sdzboi8eghdw8fmmb5xke7zp6jcgu8p8ycasegpb1nookzenbs',
    'nano_353wooh9ihduaj5auji6tgjt3n7iboh8uo1g7spkx3ome3xpxf7ctp8th4so',
    'nano_1jorthzotgrsjs863m6srzx9ia8w8mue9xu8ath5izk7s6bdutgdczt73ft4',
    'nano_3x7cjioqahgs5ppheys6prpqtb4rdknked83chf97bot1unrbdkaux37t31b'
];

export const RPC_WHITELIST = [
    'b^T2dKnCEbD*epDz$33wB3%q#', // NanoPvP.com
    'QNM8u9*C6X9ju&Ajgzb4T8$k6', // nanoce.net
];

export const RPC_CALLBACK = [
    'https://us-central1-nano-pvp.cloudfunctions.net/api/callback' // NanoPvP.com
]
