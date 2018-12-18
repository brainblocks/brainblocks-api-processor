/* @flow */

// eslint-disable-next-line import/no-commonjs, import/no-unassigned-import
require('babel-register');

// eslint-disable-next-line import/no-commonjs
const { cleanTransactions } = require('./server/clean');

try {
    cleanTransactions();
} catch (err) {
    console.error('Error in cleanTransactions()', err.stack);
    // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
    process.exit(0);
}
