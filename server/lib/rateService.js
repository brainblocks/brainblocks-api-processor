/* @flow */

import type { BigInt } from '../types';
import { CURRENCY } from '../constants';

import { request } from './util';
import { raiToRaw } from './rai';

const CRYPTOCOMPARE_URL = 'https://min-api.cryptocompare.com';
const CRYPTOCOMPARE_PRICE_URL = `${ CRYPTOCOMPARE_URL }/data/price`;
const BITPAY_RATES_URL = 'https://bitpay.com/api/rates';

const NANO = 'NANO';
const BTC = 'BTC';

export async function currencyToRaw(currency : $Values<typeof CURRENCY>, amount : string) : Promise<BigInt> {

    if (currency === CURRENCY.NANO) {
        return await raiToRaw(parseInt(amount, 10));
    }

    // amount in dollars of currency
    const floatAmont = parseFloat(amount);
    currency = currency.toUpperCase();

    const bitcoinPerRai = await request({ method: 'get', uri: `${ CRYPTOCOMPARE_PRICE_URL }?fsym=${ NANO.toUpperCase() }&tsyms=${ BTC.toUpperCase() }` });
    const allDollarsPerBitcoin = await request({ method: 'get', uri: `${ BITPAY_RATES_URL }` });
    let currencyDollarsPerBitcoin = allDollarsPerBitcoin.filter(
        rate => {
            return rate.code === currency;
        })[0];
    if (currencyDollarsPerBitcoin.rate !== undefined) {
        currencyDollarsPerBitcoin = currencyDollarsPerBitcoin.rate;
    } else {
        throw new Error(`Could not find bitpay rate for currency: ${ currency }`);
    }

    const bitcoinsForAmountOfCurrency = (floatAmont * 1000000) / parseFloat(currencyDollarsPerBitcoin);
    const raiForBitcoins = bitcoinsForAmountOfCurrency / bitcoinPerRai.BTC;

    const rounded = 1000 * parseInt(Math.floor(raiForBitcoins / 1000), 10);
    
    return await raiToRaw(rounded);
}
