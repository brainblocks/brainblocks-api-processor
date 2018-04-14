/* @flow */

import ravenSentry from 'raven';

ravenSentry.config('https://***REMOVED***:***REMOVED***@sentry.io/287275').install();

export let raven = ravenSentry;
