/* @flow */

import request from 'request';

import { POW_URL, POW_KEY } from '../config';

import { accountCreate } from './rai';
import { postInsert, postSelectOldest, postDeleteAccount } from './postgres';

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

    console.log(workAccounts);

    request.post(POW_URL, {
        json: { accounts: workAccounts, key: POW_KEY }
    }, (err, res, body) => {
        if (err) {
            console.error(err);
            return err;
        }
        return body;
    });
}

export async function getAccount() : Promise<{ account : string, privateKey : string, publicKey : string }> {
    // pull oldest account from precache database
    let { account, private: privateKey, public: publicKey } = await postSelectOldest('precache');

    if (!account) {
        // generate and submit new precache account
        await precacheAccount();

        // return on-demand account
        return await accountCreate();
    }

    // delete account from precache
    await postDeleteAccount('precache', account);

    // generate and submit new precache account
    await precacheAccount();

    // return precache account
    return { account, privateKey, publicKey };
}
