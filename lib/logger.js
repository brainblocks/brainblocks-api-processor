
let loggly = require('node-loggly-bulk');

module.exports.logger = loggly.createClient({
    token:     '***REMOVED***',
    subdomain: 'brainblocks.io',
    auth:      {
        username: 'bluepnume',
        password: '***REMOVED***'
    }
});
