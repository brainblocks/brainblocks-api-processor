/* @flow */

import { raven } from './lib/raven';
import { postQuery } from './lib/postgres';
import { cleanupWallets, destroyWallet } from './lib/rai';
import { wait } from './lib/util';
import { TRANSACTION_STATUS } from './constants';
import { processTransaction, refundTransaction, recoverAndRefundTransaction } from './transaction';

const REFUND_PERIOD = '100 minutes';

export async function cleanTransactions() : Promise<void> {

    console.log('Starting cleanup');

    await cleanupWallets();

    let transactions = await postQuery(`
            
        SELECT id, status
            FROM transaction
            WHERE (status = $1 OR status = $2 OR status = $3 OR status = $4)
            AND (created >= (NOW() - INTERVAL '${ REFUND_PERIOD }');

    `, [ TRANSACTION_STATUS.COMPLETE, TRANSACTION_STATUS.PENDING, TRANSACTION_STATUS.REFUNDED, TRANSACTION_STATUS.EXPIRED ]);

    for (let { id, status } of transactions) {
        try {

            if (status === TRANSACTION_STATUS.PENDING) {
                await processTransaction(id);
            }
        
            if (status === TRANSACTION_STATUS.REFUNDED || status === TRANSACTION_STATUS.EXPIRED || status === TRANSACTION_STATUS.COMPLETE) {
                await refundTransaction(id);
            }

        } catch (err) {
            console.error(err.stack);
            raven.captureException(err);

            try {
                if (err.message === 'Account not found in wallet' || err.message === 'Wallet not found') {
                    let account = err.data && (err.data.account || err.data.source);
                    
                    if (account) {
                        await recoverAndRefundTransaction(account);
                    }
                }
    
                if (err.message === 'Wallet locked') {
                    if (err.data && err.data.wallet) {
                        await destroyWallet(err.data.wallet);
                    }
                }
            } catch (err2) {
                console.error(err2.stack);
                raven.captureException(err2);
            }
        }
    }

    await postQuery(`

    UPDATE transaction
        SET status = $1
        WHERE (created < (NOW() - INTERVAL '${ REFUND_PERIOD }'))
        AND (status != $2);

    `, [ TRANSACTION_STATUS.PURGED, TRANSACTION_STATUS.COMPLETE ]);

    // Wait and re-queue event

    console.log('Waiting to re-initialize cleanup');

    await wait(2 * 60 * 1000);
}
