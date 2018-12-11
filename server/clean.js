/* @flow */

import { raven } from './lib/raven';
import { postQuery } from './lib/postgres';
import { TRANSACTION_STATUS } from './constants';
import { processTransaction, refundTransaction, forceProcessTransaction, checkExchanges, setTransactionStatus } from './transaction';
import { wait } from './lib/util';

const REFUND_PERIOD = '7 day';
const DELAY = 5;

export async function cleanTransactions() : Promise<void> {

    console.log('Starting cleanup');

    let transactions = await postQuery(`
            
        SELECT id, status
            FROM transaction
            WHERE (status = $1 OR status = $2 OR status = $3)
            AND (created >= (NOW() - INTERVAL '${ REFUND_PERIOD }'));

    `, [ TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.REFUNDED, TRANSACTION_STATUS.EXPIRED ]);

    for (let { id, status } of transactions) {
        try {

            if (await checkExchanges(id)) {
                await forceProcessTransaction(id);
            }

            if (status === TRANSACTION_STATUS.PENDING) {
                await processTransaction(id);
            }
        
            if (status === TRANSACTION_STATUS.REFUNDED || status === TRANSACTION_STATUS.EXPIRED) {
                await refundTransaction(id);
            }

        } catch (err) {
            console.error(err.stack);
            await setTransactionStatus(id, TRANSACTION_STATUS.ERROR);
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

    console.log(`Wait ${ DELAY } seconds to re-initialize cleanup`);

    await wait(DELAY * 1000);

    // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
    process.exit(0);
}
