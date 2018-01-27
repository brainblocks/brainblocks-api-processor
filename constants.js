
module.exports.TRANSACTION_STATUS = {
    CREATED:  'created',
    WAITING:  'waiting',
    EXPIRED:  'expired',
    REFUNDED: 'refunded',
    PENDING:  'pending',
    PURGED:   'purged',
    COMPLETE: 'complete'
};

module.exports.QUEUE = {
    PROCESS_TRANSACTION: 'process_transaction',
    REFUND_TRANSACTION:  'refund_transaction',
    CLEAN_TRANSACTIONS:  'clean_transactions'
};
