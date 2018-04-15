/* @flow */

// eslint-disable-next-line import/no-commonjs, import/no-unassigned-import
require('babel-register');

// eslint-disable-next-line import/no-commonjs
let { app, config } = require('./server');

app.listen(config.server_port);
console.log(`brainblocks server listening on http://localhost:${ config.server_port }`);
