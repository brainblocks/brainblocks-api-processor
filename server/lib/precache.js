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
        return body;
    });
}

export async function getAccount() : Promise<{ account : string, privateKey : string, publicKey : string }> {
    // pull oldest account from precache database
    let { account, private : privateKey, public : publicKey } = await postSelectOldest('precache');

    // delete account from precache
    await postDelete('precache', { account });

    // generate and submit new precache account
    await precacheAccount();

    // return precache account
    return { account, privateKey, publicKey };
}
