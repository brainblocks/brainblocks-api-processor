/* @flow */

// eslint-disable-next-line import/no-commonjs, import/no-unassigned-import
require('babel-register');

// eslint-disable-next-line import/no-commonjs
let { app, SERVER_PORT } = require('./server');

app.listen(SERVER_PORT);
console.log(`brainblocks server listening on http://127.0.0.1:${ SERVER_PORT }`);
