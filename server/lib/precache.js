/* @flow */

import request from 'request';

import { POW_URL, POW_KEY } from '../config';

import { accountCreate } from './rai';
import { postInsert, postSelectOldest, postDeleteAccount, postGetPrecacheCount } from './postgres';

export async function precacheAccount() : Promise<void> {
    // Generate New Account
    let { account,  privateKey, publicKey } = await accountCreate();
    await postInsert('precache', { account, private: privateKey, public: publicKey });

    request.post(POW_URL, {
        json: { accounts: [ account ], key: POW_KEY }
    }, (err, res, body) => {
        if (err) {
            console.error(err);
            return err;
        }
        return body;
    });
}

export async function submitAccounts(accounts : Array<{ account : string, privateKey : string, publicKey : string }>) : Promise<void> {

    let workAccounts = [];

    for (let { account, privateKey, publicKey } of accounts) {
        await postInsert('precache', { account, private: privateKey, public: publicKey });
        workAccounts.push(account);
    }

    request.post(POW_URL, {
        json: { accounts: workAccounts, key: POW_KEY }
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
    // get number of rows in precache database
    let { count } = await postGetPrecacheCount('precache');

    console.log('precache queue:', count);

    if (count >= 1) {
        // pull oldest account from precache database
        let { account, private: privateKey, public: publicKey } = await postSelectOldest('precache');

        // delete account from precache
        await postDeleteAccount('precache', account);

        // generate and submit new precache account
        await precacheAccount();

        // return precache account
        return { account, privateKey, publicKey };
    } else {
        // generate and submit new precache account
        await precacheAccount();

        // return on-demand account
        let { account,  privateKey, publicKey } = await accountCreate();

        // return precache account
        return { account, privateKey, publicKey };
    }
}
