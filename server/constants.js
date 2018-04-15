/* @flow */

export const TRANSACTION_STATUS = {

    // Transaction has been created. The buyer has clicked on a button,
    // and an account has been created, but the client is not yet listening
    // for transfers
    CREATED:  'created',

    // We are waiting for buyer to send funds into the account matching or
    // exceeding the amount of the transaction
    WAITING:  'waiting',

    // The buyer has not sent funds in time and the transaction has expired
    EXPIRED:  'expired',

    // The transaction has been refunded, if any balance was sent late. Transactions
    // with this status will still be monitored for payments for 100 minutes.
    REFUNDED: 'refunded',

    // The payment has been made, the funds are pending in the account, and the buyer
    // has proceeded on the merchant's page -- but the processing / PoW has not yet happened
    // on the BrainBlocks side for the send/recieve blocks
    PENDING:  'pending',
    
    // The transaction has been fully processed. We will wait 100 minutes for any subsequent
    // payments that we might need to refund.
    COMPLETE: 'complete',

    // The transaction has been purged. We will not wait for any more activity on this account
    PURGED:   'purged'
};

// Happy case: CREATED -> WAITING -> PENDING -> COMPLETE
// Unhappy case: CREATED -> WAITING -> EXPIRED -> REFUNDED -> PURGED
