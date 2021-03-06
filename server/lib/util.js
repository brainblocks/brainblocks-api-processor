/* @flow */
/* global express$Request */
/* global express$Response */

import uuidv4 from 'uuid/v4';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import requestPromise from 'request-promise';
import bigInt from 'big-integer';

import type { BigInt } from '../types';

import { raven } from './raven';

export function ValidationError(message : string) {
    this.name = 'ValidationError';
    this.message = (message || '');
}

// $FlowFixMe
ValidationError.prototype = Error.prototype;

type HandlerOptionsType = {
    log? : boolean
};

export function handler<T : Object>(fn : (req : express$Request, res : express$Response) => Promise<T>, opts : HandlerOptionsType = {}) : (req : express$Request, res : express$Response) => Promise<void> {
    return async (req : express$Request, res : express$Response) => {
        let uuid = uuidv4();

        try {
            if (opts.log) {
                console.log(uuid, req.originalUrl, req.body);
            }
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

export function buffer <T>(method : () => Promise<T>) : () => Promise<T> {
    let nextResult;
    return async () => {
        let result = nextResult;
        nextResult = method();
        return await (result || nextResult);
    };
}

export function eventEmitter <T>() : { publish : (T) => void, listen : ((T) => void) => { cancel : () => void } } {

    let listeners = [];

    return {
        publish: (data) => {
            for (let listener of listeners) {
                listener(data);
            }
        },

        listen: (listener) => {
            listeners.push(listener);

            return {
                cancel: () => {
                    listeners.splice(listeners.indexOf(listener), 1);
                }
            };
        }
    };
}

export function debounce(method : () => mixed, delay : number) : () => void {
    let timeout;
    return function debounceWrapper() {
        clearTimeout(timeout);
        timeout = setTimeout(() => method.apply(this, arguments), delay);
    };
}

type PromiseHandlerOptions<T> = {
    resolve : (T) => void,
    reject : (mixed) => void,
    run : (() => Promise<void>) => Promise<void>
};

export function promise<T>(promiseHandler : (PromiseHandlerOptions<T>) => void) : Promise<T> {
    return new Promise((resolve, reject) => {

        let run = async (method) => {
            try {
                await method();
            } catch (err) {
                reject(err);
            }
        };

        promiseHandler({ resolve, reject, run });
    });
}

let memoizedFunctions = [];

export function memoize<R : mixed, A : Array<*>> (method : (...args: A) => Promise<R> | R) : ((...args: A) => Promise<R> | R) {

    let cache : { [key : string] : Promise<R> | R } = {};

    let resultFunction = function memoizedFunction(...args : A) : Promise<R> | R {

        let key : string;

        try {
            key = JSON.stringify(Array.prototype.slice.call(args));
        } catch (err) {
            throw new Error(`Arguments not serializable -- can not be used to memoize`);
        }

        if (!cache[key]) {
            cache[key] = method(...args);
        }

        if (cache[key] && typeof cache[key].then === 'function' && typeof cache[key].catch === 'function') {
            cache[key].catch(() => {
                delete cache[key];
            });
        }

        return cache[key];
    };

    resultFunction.clear = () => {
        cache = {};
    };

    memoizedFunctions.push(resultFunction);

    return resultFunction;
}

memoize.clear = () => {
    memoizedFunctions.forEach(fn => fn.clear());
};


export function memoizePromise<R : mixed, A : Array<*>> (method : (...args: A) => Promise<R>) : ((...args: A) => Promise<R>) {
    let resultFunction = memoize((...args : A) => {
        let result = method(...args);

        result.then(resultFunction.clear, resultFunction.clear);

        return result;
    });

    // $FlowFixMe
    return resultFunction;
}

export function toBigInt(num : string) : BigInt {
    return bigInt(num);
}
