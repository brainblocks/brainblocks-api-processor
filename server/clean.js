/* @flow */

import { raven } from './lib/raven';
import { postQuery } from './lib/postgres';
import { wait } from './lib/util';
import { TRANSACTION_STATUS } from './constants';
import { processTransaction, refundTransaction, forceProcessTransaction, checkExchanges } from './transaction';

const REFUND_PERIOD = '1 day';

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
