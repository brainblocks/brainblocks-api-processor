/* @flow */

import { request, memoize } from './util';

const COINMARKETCAP_URL = 'https://api.coinmarketcap.com/v2';
const COINMARKETCAP_LISTINGS_URL = `${ COINMARKETCAP_URL }/listings/`;
const COINMARKETCAP_TICKER_URL = `${ COINMARKETCAP_URL }/ticker/`;

const NANO = 'nano';

let getID = memoize(async currency => {
    let listings = await request({ method: 'get', uri: COINMARKETCAP_LISTINGS_URL });
    for (let listing of listings.data) {
        if (listing.symbol.toLowerCase() === currency) {
            console.warn('woot!!!');
            return listing.id;
        }
    }
    throw new Error(`Could not find coinmarketcap id for ${ currency }`);
});

export async function toRai(currency : string, amount : string) : Promise<number> {

    let id = await getID(NANO);
    let floatAmount = parseFloat(amount);
    currency = currency.toUpperCase();

    let rates = await request({ method: 'get', uri: `${ COINMARKETCAP_TICKER_URL }/${ id }/?convert=${ currency }` });
    let price = parseFloat(rates.data.quotes[currency].price);
    let rai = Math.floor((floatAmount * 1000000) / price);
    let rounded = 1000 * parseInt(Math.floor(rai / 1000), 10);

    return rounded;
}
