/* @flow */

// eslint-disable-next-line import/no-commonjs, import/no-unassigned-import
require('babel-register');

// eslint-disable-next-line import/no-commonjs
const { populate } = require('./precache/index');

populate().catch(err => {
    console.error('Error in populate()', err.stack);
    // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
    process.exit(1);
});
