const raven = require('raven');

raven.config('https://***REMOVED***:***REMOVED***@sentry.io/287275').install();

module.exports.raven = raven;