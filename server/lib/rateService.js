/* @flow */

import type { BigInt } from '../types';
import { CURRENCY } from '../constants';

import { request } from './util';
import { raiToRaw } from './rai';

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
    currency = currency.toUpperCase();

    const bitcoinPerNano = await request({ method: 'get', uri: `${ CRYPTOCOMPARE_PRICE_URL }?fsym=${ NANO.toUpperCase() }&tsyms=${ BTC.toUpperCase() }` });
    const allDollarsPerBitcoin = await request({ method: 'get', uri: `${ BITCOIN_RATES_URL }` });

    let currencyDollarsPerBitcoin = allDollarsPerBitcoin.filter(
        rate => {
            return rate.code === currency;
        })[0];

    if (currencyDollarsPerBitcoin.rate !== undefined) {
        currencyDollarsPerBitcoin = currencyDollarsPerBitcoin.rate;
    } else {
        throw new Error(`Could not find bitcoin rate for currency: ${ currency }`);
    }

    const bitcoinsForAmountOfCurrency = (floatAmont * 1000000) / parseFloat(currencyDollarsPerBitcoin);
    const nanoForBitcoins = bitcoinsForAmountOfCurrency / bitcoinPerNano.BTC;

    const rounded = 1000 * parseInt(Math.floor(nanoForBitcoins / 1000), 10);
    
    return await raiToRaw(rounded);
}

export async function getPrices() : Promise<Array<{ id : string, price : number }>> {
    const bitcoinPerNano = await request({ method: 'get', uri: `${ CRYPTOCOMPARE_PRICE_URL }?fsym=${ NANO.toUpperCase() }&tsyms=${ BTC.toUpperCase() }` });
    const allDollarsPerBitcoin = await request({ method: 'get', uri: `${ BITCOIN_RATES_URL }` });
    const prices = [];

    allDollarsPerBitcoin.forEach(item => {
        const newPrice = (item.rate * bitcoinPerNano.BTC);
        prices.push({ 'id': item.code, 'price': newPrice });
    });
    
    return prices;
}
