/* @flow */

import { postQuery } from './lib/postgres';
import { TRANSACTION_STATUS } from './constants';
import { accountHistory, raiToRaw } from './lib/rai';
import { setTransactionStatus } from './transaction';

export async function recoverTransactions() : Promise<void> {

    console.log('Starting recovery');

    let transactions = await postQuery(`
            
        SELECT id, account, destination, amount_rai
            FROM transaction
            WHERE (status != $1);

    `, [ TRANSACTION_STATUS.COMPLETE ]);

    for (let { id, account, destination, amount_rai } of transactions) {
        try {
            let history = await accountHistory(account);

            for (let { type, account: dest, amount } of history) {
                if (type === 'send' && dest === destination) {
                    let amount_raw = await raiToRaw(amount_rai);
                    if (amount_raw.equals(amount)) {
                        console.log('MATCH', account, amount_rai);
                        await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
                    }
                }
            }


        } catch (err) {
            console.error(err.stack);
        }
    }

    // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
    process.exit(0);
}
