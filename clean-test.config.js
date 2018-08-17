/* @flow */
/* eslint key-spacing: ["error", { "beforeColon": true }] */
export default {
    apps : [ {
        name : 'clean',
        script : './clean.js',
        watch : false,
        env : {
            'NODE_ENV' : 'test'
        }
    } ]
};
