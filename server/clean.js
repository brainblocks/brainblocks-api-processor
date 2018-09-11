/* @flow */

import { raven } from './lib/raven';
import { postQuery } from './lib/postgres';
import { wait } from './lib/util';
import { TRANSACTION_STATUS } from './constants';
import { processTransaction, refundTransaction, forceProcessTransaction, checkExchanges } from './transaction';

const REFUND_PERIOD = '1 day';

const exchangeWhitelist = [
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

export async function cleanTransactions() : Promise<void> {

    console.log('Starting cleanup');

    let transactions = await postQuery(`
            
        SELECT id, status
            FROM transaction
            WHERE (status = $1 OR status = $2 OR status = $3 OR status = $4)
            AND (created >= (NOW() - INTERVAL '${ REFUND_PERIOD }'));

    `, [ TRANSACTION_STATUS.COMPLETE, TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.REFUNDED, TRANSACTION_STATUS.EXPIRED ]);

    for (let { id, status } of transactions) {
        try {

            if (await checkExchanges(id)) {
                await forceProcessTransaction(id);
            }

            if (status === TRANSACTION_STATUS.PENDING) {
                await processTransaction(id);
            }
        
            if (status === TRANSACTION_STATUS.REFUNDED || status === TRANSACTION_STATUS.EXPIRED || status === TRANSACTION_STATUS.COMPLETE) {
                await refundTransaction(id);
            }

        } catch (err) {
            console.error(err.stack);
            raven.captureException(err);
        }
    }

    await postQuery(`

    UPDATE transaction
        SET status = $1
        WHERE (created < (NOW() - INTERVAL '${ REFUND_PERIOD }'))
        AND (status != $2)
        AND (status != $3);

    `, [ TRANSACTION_STATUS.PURGED, TRANSACTION_STATUS.COMPLETE, TRANSACTION_STATUS.PENDING ]);

    // Wait and re-queue event

    console.log('Waiting to re-initialize cleanup');

    await wait(5 * 1000);
}
