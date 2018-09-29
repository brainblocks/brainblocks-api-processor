/* @flow */

import { TRANSACTION_STATUS } from './constants';
import { postInsert, postSelectOne, postSelectID, postUpdateID } from './lib/postgres';
import { refundAccount, receiveAllPending, send, recoverAndRefundAccount, getSenders, getBalance } from './lib/rai';

const exchangeWhitelist = [
    'xrb_3jwrszth46rk1mu7rmb4rhm54us8yg1gw3ipodftqtikf5yqdyr7471nsg1k',
    'xrb_1niabkx3gbxit5j5yyqcpas71dkffggbr6zpd3heui8rpoocm5xqbdwq44oh',
    'xrb_1tig1rio7iskejqgy6ap75rima35f9mexjazdqqquthmyu48118jiewny7zo',
    'xrb_1k3irh88nf9pqec7pzpy6j46bewi36oct3quecciqajfeycpi1n4neecju7w',
    'xrb_18iofanfwdzqiq54aist741srnt7izcmmktgdub4iiwpgpzsuqjgkzmnahnq',
    'xrb_3rpc6f6ibeisa3cpn8j3x8jyxym5bp1mu4dswrqr17w4cnd5jepjqsjpaq3h',
    'xrb_1ejwssecquqhppb75mgf4wt4iunerirzksiq4pokdzqreyfzj5ecnksiisjm',
    'xrb_38fptyek1cybg1z64mdc9udj89uk4en4atig6ftzb9ui1xkemgtbzzfg8r85',
    'xrb_1zdpsyaxadcxfof81h9f37arkwnuyrngu33qm5ngj3mmptmjgrikykx38zfs',
    'xrb_1j4xxpxf36qzudexhm9peu1qkjo5ehx4srhibbhzmgewomxa7nodxf57rsju',
    'xrb_3azhmyaof9sdzboi8eghdw8fmmb5xke7zp6jcgu8p8ycasegpb1nookzenbs',
    'xrb_353wooh9ihduaj5auji6tgjt3n7iboh8uo1g7spkx3ome3xpxf7ctp8th4so',
    'xrb_1jorthzotgrsjs863m6srzx9ia8w8mue9xu8ath5izk7s6bdutgdczt73ft4',
    'xrb_3x7cjioqahgs5ppheys6prpqtb4rdknked83chf97bot1unrbdkaux37t31b',
    'xrb_1jnatu97dka1h49zudxtpxxrho3j591jwu5bzsn7h1kzn3gwit4kejak756y'
];

const TRANSACTION_FIELDS = [ 'id', 'status', 'destination', 'amount', 'amount_rai', 'account', 'currency', 'private', 'public' ];

const PAYPAL_TRANSACTION_FIELDS = [ 'id', 'status', 'amount', 'currency', 'email', 'payment_id' ];

type TransactionType = {
    id : string,
    status : string,
    destination : string,
    amount : string,
    amount_rai : number,
    account : string,
    currency : string,
    private : string,
    public : string
};

type PublicTransactionType = {
    status : string,
    destination : string,
    amount : string,
    amount_rai : number,
    account : string,
    currency : string,
    privateKey : string,
    publicKey : string
};

type PayPalTransactionType = {
    id : string,
    status : string,
    amount : string,
    currency : string,
    email : string,
    payment_id : string
};

type PublicPayPalTransactionType = {
    status : string,
    amount : string,
    currency : string,
    email : string,
    payment_id : string
};

export async function createTransaction({ status = TRANSACTION_STATUS.CREATED, destination, amount, amount_rai, account, currency, privateKey, publicKey } : PublicTransactionType) : Promise<string> {
    let result = await postInsert('transaction', { status, destination, amount, amount_rai, wallet: 'XXXXXXX', account, currency, private: privateKey, public: publicKey });
    return result.id;
}

export async function createPayPalTransaction({ status = TRANSACTION_STATUS.CREATED, amount, currency, email, payment_id } : PublicPayPalTransactionType) : Promise<string> {
    let result = await postInsert('paypal_transaction', { status, amount, currency, email, payment_id  });
    return result.id;
}

export async function getTransaction(id : string) : Promise<TransactionType> {
    let transaction = await postSelectID('transaction', id, TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getPayPalTransaction(id : string) : Promise<PayPalTransactionType> {
    let transaction = await postSelectID('paypal_transaction', id, PAYPAL_TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getTransactionByAccount(account : string) : Promise<TransactionType> {
    let transaction = await postSelectOne('transaction', { account }, TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function getTransactionByDestination(destination : string) : Promise<TransactionType> {
    let transaction = await postSelectOne('transaction', { destination }, TRANSACTION_FIELDS);
    transaction.amount_rai = parseInt(transaction.amount_rai, 10);
    return transaction;
}

export async function setTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('transaction', id, { status });
}

export async function setPayPalTransactionStatus(id : string, status : string) : Promise<void> {
    return await postUpdateID('paypal_transaction', id, { status });
}

export async function processTransaction(id : string) : Promise<void> {
    let { private: privateKey, amount_rai, destination } = await getTransaction(id);

    await receiveAllPending(privateKey);
    await send(privateKey, amount_rai, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
}

export async function checkExchanges(id : string) : Promise<boolean> {
    let { private: privateKey } = await getTransaction(id);

    let senders = await getSenders(privateKey);

    let exchage = false;

    for (let sender of senders) {
        if (exchangeWhitelist.indexOf(sender) > -1) {
            exchage = true;
        }
    }

    return exchage;
}

export async function refundTransaction(id : string) : Promise<void> {
    let { private: privateKey, status } = await getTransaction(id);

    await refundAccount(privateKey);
    if (status !== TRANSACTION_STATUS.COMPLETE) {
        await setTransactionStatus(id, TRANSACTION_STATUS.REFUNDED);
    }
}

export async function recoverAndRefundTransaction(account : string) : Promise<void> {
    let { private: privateKey } = await getTransactionByAccount(account);
    await recoverAndRefundAccount(privateKey);
}

export async function forceProcessTransaction(id : string) : Promise<void> {
    let { private: privateKey, amount_rai, destination, account } = await getTransaction(id);

    await receiveAllPending(privateKey);

    let { balance } = await getBalance(account);
    let amountToProcess = Math.min(balance, amount_rai);

    await send(privateKey, amountToProcess, destination);
    await refundAccount(privateKey);
    await setTransactionStatus(id, TRANSACTION_STATUS.COMPLETE);
}

export async function recoverAndProcessTransaction(account : string) : Promise<void> {
    let { id } = await getTransactionByAccount(account);
    await forceProcessTransaction(id);
}
