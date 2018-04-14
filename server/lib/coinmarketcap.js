/* @flow */

import { request } from './util';

const COINMARKETCAP_URL = 'https://api.coinmarketcap.com/v1';

export async function toRai(currency : string, amount : string) : Promise<number> {
    let floatAmount = parseFloat(amount);

    let rates = await request({ method: 'get', uri: `${ COINMARKETCAP_URL }/ticker/nano/?convert=${ currency }` });
    let rai = Math.floor((floatAmount * 1000000) / parseFloat(rates[0][`price_${ currency }`]));
    let rounded = 1000 * parseInt(Math.floor(rai / 1000), 10);

    return rounded;
}
