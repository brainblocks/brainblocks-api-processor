/* eslint flowtype/require-valid-file-annotation: 0, eol-last: 0, semi: 0 */

import { createTransaction } from './server/transaction';
import { TRANSACTION_STATUS } from './server/constants';

(async () => {
    await createTransaction({ status: TRANSACTION_STATUS.CREATED, destination: 'xyz', amount: '0.001', amount_rai: 1, account: 'xrb_2343232sdfwegweg', currency: 'rai', privateKey: 'abc', publicKey: 'xyz' });
})()