/* @flow */

import { submitAccounts } from '../server/lib/precache';
import { accountCreate } from '../server/lib/rai';
import { wait } from '../server/lib/util';

const ACCOUNTS = 1000;

export async function populate() : Promise<void> {
    let accounts = [];

    for (var i = 0; i < ACCOUNTS; i++) {
        // Generate New Account
        accounts.push(await accountCreate());
        await wait(2 * 1000);
    }

    submitAccounts(accounts);
}
