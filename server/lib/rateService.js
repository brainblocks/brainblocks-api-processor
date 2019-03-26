/* @flow */

import type { BigInt } from '../types';
import { CURRENCY } from '../constants';

import { request } from './util';
import { raiToRaw } from './rai';
import { postUpdateID, postSelectID, postQuery, postInsert } from './postgres';

const CRYPTOCOMPARE_PRICE_URL = `https://min-api.cryptocompare.com/data/price`;
const BITCOIN_RATES_URL = 'https://bitpay.com/api/rates';

const NANO = 'NANO';
const BTC = 'BTC';

export async function currencyToRaw(currency : $Values<typeof CURRENCY>, amount : string) : Promise<BigInt> {

    if (currency === CURRENCY.NANO) {
        return await raiToRaw(parseInt(amount, 10));
    }

    // amount in dollars of currency
    const floatAmont = parseFloat(amount);
    const id = currency.toLowerCase();

    let { price } = await postSelectID('pos_currencies', id, [ 'price' ]);

    const rate = (floatAmont * 1000000) / parseFloat(price);
    const rounded = 1000 * parseInt(Math.floor(rate / 1000), 10);
    
    return await raiToRaw(rounded);
}

export async function pullRates() : Promise<Array<{ id : string, price : number, timestamp : number }>> {
    return await postQuery(`SELECT * FROM pos_currencies;`);
}

export async function getRates() : Promise<Array<{ id : string, price : string, timestamp : string }>> {
    const bitcoinPerNano = await request({ method: 'get', uri: `${ CRYPTOCOMPARE_PRICE_URL }?fsym=${ NANO.toUpperCase() }&tsyms=${ BTC.toUpperCase() }` });
    const allDollarsPerBitcoin = await request({ method: 'get', uri: `${ BITCOIN_RATES_URL }` });
    const prices = [];

    // get current time
    const date = new Date();
    const currentTime = date.getTime();

    allDollarsPerBitcoin.forEach(item => {
        const newPrice = (item.rate * bitcoinPerNano.BTC);
        item.code.toUpperCase();
        prices.push({ 'id': item.code.toLowerCase(), 'price': newPrice.toString(), 'timestamp': currentTime.toString() });
    });

    
    return prices;
}

export function checkRateArray(item : string, arr : Array<{ id : string, price : number, timestamp : number }>) : Promise<boolean>  {
    for (let object of arr) {
        if (object.id === item) {
            return true;
        }
    }
    
    return false;
}

export async function updateRates() : Promise<string> {

    const rates = await getRates();
    const savedRates = await pullRates();

    for (let { id, price, timestamp } of rates) {
        if (await checkRateArray(id, savedRates)) {
            await postUpdateID('pos_currencies', id, { price, timestamp });
        } else {
            await postInsert('pos_currencies', { id, price, timestamp });
        }
    }

    return 'success';
}
