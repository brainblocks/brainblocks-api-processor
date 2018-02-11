
let { request } = require('./util');

let COINMARKETCAP_URL = 'https://api.coinmarketcap.com/v1';

module.exports.fromRai = function fromRai() {

}

module.exports.toRai = async function toRai(currency, amount) {
    amount = parseFloat(amount);

    let rates = await request({ method: 'get', uri: `${ COINMARKETCAP_URL }/ticker/raiblocks/?convert=${ currency }` });

    let rai = Math.floor((amount * 1000000) / parseFloat(rates[0][`price_${currency}`]));

    let rounded = 1000 * parseInt(Math.floor(rai / 1000));

    return rounded;
}