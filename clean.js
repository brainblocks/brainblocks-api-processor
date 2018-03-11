#!/usr/bin/env node

let { postQuery, postSelect } = require('./lib/postgres');
let { removeAccount, cleanupWallets, unlockWallet, destroyWallet } = require('./lib/rai');
let { wait } = require('./lib/util');

let { TRANSACTION_STATUS, QUEUE } = require('./constants');
let { processTransaction, refundTransaction, setTransactionStatus, recoverAndRefundTransactionAccount } = require('./transaction');

async function cleanTransactions() {

    console.log('Starting cleanup');

    try {

        let pending = await postQuery(`
        
            SELECT id
                FROM transaction where status = $1;

        `, [ TRANSACTION_STATUS.PENDING ]);

        for (let { id } of pending) {
            await processTransaction(id);
        }

        // Re-refund recently refunded transactions

        let refunded = await postQuery(`
        
            SELECT id
                FROM transaction
                WHERE (status = $1 AND modified > (NOW() - INTERVAL '60 minutes'));

        `, [ TRANSACTION_STATUS.REFUNDED ]);

        for (let { id } of refunded) {
            await refundTransaction(id);
        }

        // Expire and refund transactions

        await postQuery(`

            UPDATE transaction
                SET status = $1
                WHERE (status = $2 AND modified < (NOW() - INTERVAL '20 minutes'))
                OR    (status = $3 AND modified < (NOW() - INTERVAL '20 minutes'))
                OR    (status = $4 AND modified < (NOW() - INTERVAL '60 minutes'));

        `, [ TRANSACTION_STATUS.EXPIRED, TRANSACTION_STATUS.CREATED, TRANSACTION_STATUS.WAITING, TRANSACTION_STATUS.PENDING ]);

        let expired = await postSelect('transaction', { status: TRANSACTION_STATUS.EXPIRED });

        for (let { id } of expired) {
            await refundTransaction(id);
        }

        // Clean up accounts for old, refunded transactions

        let oldRefunded = await postQuery(`
        
            SELECT id, wallet, account
                FROM transaction
                WHERE (status = $1 AND modified < (NOW() - INTERVAL '300 minutes'));

        `, [ TRANSACTION_STATUS.REFUNDED ]);

        for (let { id, wallet, account } of oldRefunded) {
            await refundTransaction(id);
            await removeAccount(wallet, account);
            await setTransactionStatus(id, TRANSACTION_STATUS.PURGED);
        }

        await cleanupWallets();

    } catch (err) {

        try {
            if (err.message === 'Account not found in wallet' || err.message === 'Wallet not found') {
                if (err.data && err.data.account) {
                    await recoverAndRefundTransactionAccount(err.data.account);
                    return cleanTransactions();
                }
            }

            if (err.message === 'Wallet locked') {
                if (err.data && err.data.wallet) {
                    await destroyWallet(err.data.wallet);
                    return cleanTransactions();
                }
            }
        } catch (err) {
            if (err.message === 'Wallet locked') {
                if (err.data && err.data.wallet) {
                    
                    await destroyWallet(err.data.wallet);
                    
                    return cleanTransactions();
                }
            }

            console.error(err.stack);
        }
    }

    // Wait and re-queue event

    console.log('Waiting to re-initialize cleanup');

    await wait(2 * 60 * 1000);

    publish(QUEUE.CLEAN_TRANSACTIONS);
}

async function setupQueue() {
    let queue = await subscribe(QUEUE.CLEAN_TRANSACTIONS, cleanTransactions, { singleton: true, cancelOnExit: true });
    publish(QUEUE.CLEAN_TRANSACTIONS);
}

setupQueue();