/* @flow */

import ravenSentry from 'raven';

// ravenSentry.config('https://***REMOVED***:***REMOVED***@sentry.io/287275').install();

ravenSentry.config('https://***REMOVED***:***REMOVED***@sentry.io/287275', {
    sampleRate: 0.5 // send 50% of events, drop the other half
}).install();

ravenSentry.disableConsoleAlerts();

export let raven = ravenSentry;
