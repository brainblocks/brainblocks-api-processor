/* @flow */

import request from 'request';

import { accountCreate } from './rai';
import { postInsert, postSelectOldest, postDelete } from './postgres';

export async function precacheAccount() : Promise<void> {
    // Generate New Account
    let { account,  privateKey, publicKey } = await accountCreate();
    await postInsert('precache', { account, private: privateKey, public: publicKey });

    request.post('http://178.62.11.37:5000/work', {
        json: { accounts: [ account ], key: '8F17AFEB7851AA305091D436E2046025' }
    }, (err, res, body) => {
        if (err) {
            console.error(err);
            return err;
        }
        console.log(body);
        return body;
    });
}

export async function submitAccounts(accounts : Array) : Promise<void> {

    let workAccounts = [];

    for (let { account, privateKey, publicKey } of accounts) {
        await postInsert('precache', { account, private: privateKey, public: publicKey });
        workAccounts.push(account);
    }

    console.log(workAccounts);

    request.post('http://178.62.11.37:5000/work', {
        json: { accounts: workAccounts, key: '8F17AFEB7851AA305091D436E2046025' }
    }, (err, res, body) => {
        if (err) {
            console.error(err);
            return err;
        }
        console.log(body);
        return body;
    });
}

export async function getAccount() : Promise<{ account : string, privateKey : string, publicKey : string }> {
    // pull oldest account from precache database
    let { account, privateKey, publicKey } = await postSelectOldest('precache');

    if (!account) {
        // generate and submit new precache account
        await precacheAccount();

        // return on-demand account
        return await accountCreate();
    } else {
        // delete account from precache
        await postDelete('precache', { account });

        // generate and submit new precache account
        await precacheAccount();

        // return precache account
        return { account, privateKey, publicKey };
    }
}
