/* @flow */

import loggly from 'node-loggly-bulk';

export let logger = loggly.createClient({
    token:     '***REMOVED***',
    subdomain: 'brainblocks.io',
    auth:      {
        username: 'bluepnume',
        password: '***REMOVED***'
    }
});
