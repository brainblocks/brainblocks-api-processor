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
    RAI_SERVER = 'http://ssh.node2.brainblocks.io:7076';
    // RAI_SERVER = 'http://[10.136.7.198]:7076';
}

export const PAYPAL_CLIENT = '***REMOVED***';
export const PAYPAL_SECRET = '***REMOVED***';

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
    'xrb_3x7cjioqahgs5ppheys6prpqtb4rdknked83chf97bot1unrbdkaux37t31b',
    'xrb_1jnatu97dka1h49zudxtpxxrho3j591jwu5bzsn7h1kzn3gwit4kejak756y'
];
