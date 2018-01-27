
let uuidv4 = require('uuid/v4');
let { decode, TokenExpiredError, JsonWebTokenError } = require('jsonwebtoken');
let base64 = require('base-64');
let requestPromise = require('request-promise');

let { logger } = require('./logger');
let { config } = require('../config');

module.exports.ValidationError = function ValidationError(message) {
    this.name = "ValidationError";
    this.message = (message || "");
}
module.exports.ValidationError.prototype = Error.prototype;

module.exports.handler = function handler(fn) {
    return async (req, res) => {
        let uuid = uuidv4();

        try {
            console.log(uuid, req.originalUrl, req.body);
            if (req.params.token) {
                console.log(uuid, decode(base64.decode(req.params.token), config.secret));
            }
            logger.log({ request: req.originalUrl });
            res.writeHead(200, { 'content-type': 'application/json' });
            res.write('   ');
            let result = await fn(req, res);
            res.write(JSON.stringify(result, 0, 4));
            res.end();
        } catch (err) {
            console.error(uuid, err.stack || err.message || err.toString());
            logger.log({ uuid, request_error: err.stack || err.message || err.toString() });

            let message = 'Internal server error';

            if (err instanceof module.exports.ValidationError) {
                message = err.message;
            } else if (err instanceof TokenExpiredError) {
                message = 'Token expired';
            } else if (err instanceof JsonWebTokenError) {
                message = 'Invalid token';
            }

            res.write(JSON.stringify({ status: 'error', message, uuid }, 0, 4));
            res.end();
        }
    };
}

module.exports.wait = function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.request = async function request({ method, uri, json }) {

    let options = { method, uri };

    if (json) {
        options.body = JSON.stringify(json);
    }

    options.resolveWithFullResponse = true;

    let res = await requestPromise(options);

    if (!res.statusCode) {
        throw new Error(`Expected status code from request to ${ uri }`);
    }

    if (res.statusCode !== 200) {
        throw new Error(`Expected 200 status code from request to ${ uri }, got ${ res.statusCode }`);
    }
    
    let data = JSON.parse(res.body);

    return data;
}
