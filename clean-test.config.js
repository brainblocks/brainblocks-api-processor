/* @flow */
/* eslint import/no-commonjs: off */

module.exports = {
    apps: [ {
        name:   'clean',
        script: './clean.js',
        watch:  false,
        env:    {
            'NODE_ENV': 'test'
        }
    } ]
};
