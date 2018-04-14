/* @flow */

import uuidv4 from 'uuid/v4';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import requestPromise from 'request-promise';

import { raven } from './raven';
import { logger } from './logger';

export function ValidationError(message : string) {
    this.name = 'ValidationError';
    this.message = (message || '');
}

// $FlowFixMe
ValidationError.prototype = Error.prototype;

export function handler<T : Object>(fn : (req : express$Request, res : express$Response) => Promise<T>) : (req : express$Request, res : express$Response) => Promise<void> {
    return async (req : express$Request, res : express$Response) => {
        let uuid = uuidv4();

        try {
            console.log(uuid, req.originalUrl, req.body);
            logger.log({ request: req.originalUrl });
            res.writeHead(200, { 'content-type': 'application/json' });
            res.write('   ');
            let result = await fn(req, res);
            res.write(JSON.stringify(result, null, 4));
            res.end();
        } catch (err) {
            console.error(uuid, err.stack || err.message || err.toString());
            raven.captureException(err);

            let message = 'Internal server error';

            if (err instanceof ValidationError) {
                message = err.message;
            } else if (err instanceof TokenExpiredError) {
                message = 'Token expired';
            } else if (err instanceof JsonWebTokenError) {
                message = 'Invalid token';
            }

            res.write(JSON.stringify({ status: 'error', message, uuid }, null, 4));
            res.end();
        }
    };
}

export async function wait(ms : number) : Promise<void> {
    return await new Promise(resolve => setTimeout(resolve, ms));
}

export async function request<R : Object, T : Object>({ method, uri, json } : { method : string, uri : string, json? : R }) : Promise<T> {

    let options : Object = { method, uri };

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

export function noop() {
    // pass
}
