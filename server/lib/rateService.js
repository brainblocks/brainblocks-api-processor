/* @flow */

import { request } from './util';

const CRYPTOCOMPARE_URL = 'https://min-api.cryptocompare.com';
const CRYPTOCOMPARE_PRICE_URL = `${ CRYPTOCOMPARE_URL }/data/price`;
const BITPAY_RATES_URL = 'https://bitpay.com/api/rates';

const NANO = 'NANO';
const BTC = 'BTC';

export const SUPPORTED_CURRENCIES = [
    'btc',
    'bch',
    'usd',
    'eur',
    'gbp',
    'jpy',
    'cad',
    'aud',
    'cny',
    'chf',
    'sek',
    'nzd',
    'krw',
    'aed',
    'afn',
    'all',
    'amd',
    'ang',
    'aoa',
    'ars',
    'awg',
    'azn',
    'bam',
    'bbd',
    'bdt',
    'bgn',
    'bhd',
    'bif',
    'bmd',
    'bnd',
    'bob',
    'brl',
    'bsd',
    'btn',
    'bwp',
    'bzd',
    'cdf',
    'clf',
    'clp',
    'cop',
    'crc',
    'cup',
    'cve',
    'czk',
    'djf',
    'dkk',
    'dop',
    'dzd',
    'egp',
    'etb',
    'fjd',
    'fkp',
    'gel',
    'ghs',
    'gip',
    'gmd',
    'gnf',
    'gtq',
    'gyd',
    'hkd',
    'hnl',
    'hrk',
    'htg',
    'huf',
    'idr',
    'ils',
    'inr',
    'iqd',
    'irr',
    'isk',
    'jep',
    'jmd',
    'jod',
    'kes',
    'kgs',
    'khr',
    'kmf',
    'kpw',
    'kwd',
    'kyd',
    'kzt',
    'lak',
    'lbp',
    'lkr',
    'lrd',
    'lsl',
    'lyd',
    'mad',
    'mdl',
    'mga',
    'mkd',
    'mmk',
    'mnt',
    'mop',
    'mru',
    'mur',
    'mvr',
    'mwk',
    'mxn',
    'myr',
    'mzn',
    'nad',
    'ngn',
    'nio',
    'nok',
    'npr',
    'omr',
    'pab',
    'pen',
    'pgk',
    'php',
    'pkr',
    'pln',
    'pyg',
    'qar',
    'ron',
    'rsd',
    'rub',
    'rwf',
    'sar',
    'sbd',
    'scr',
    'sdg',
    'sgd',
    'shp',
    'sll',
    'sos',
    'srd',
    'stn',
    'svc',
    'syp',
    'szl',
    'thb',
    'tjs',
    'tmt',
    'tnd',
    'top',
    'try',
    'ttd',
    'twd',
    'tzs',
    'uah',
    'ugx',
    'uyu',
    'uzs',
    'vef',
    'vnd',
    'vuv',
    'wst',
    'xaf',
    'xcd',
    'xof',
    'xpf',
    'yer',
    'zar',
    'zmw',
    'zwl',
    'xag',
    'xau'
];

export async function toRai(currency : string, amount : string) : Promise<number> {
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

    return rounded;
}
