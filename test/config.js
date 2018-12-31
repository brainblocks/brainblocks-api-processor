/* @flow */

export const PORT = process.env.DB_PORT || 8000;
export const DB_HOST = process.env.DB_HOST || '127.0.0.1';
export const URL = `http://${ DB_HOST }:${ PORT }`;

export const NANO_PORT = 7070;
export const NANO_SERVER = `http://127.0.0.1:${ NANO_PORT }`;
