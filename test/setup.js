/* @flow */

import { app } from '../server';
import { postQuery, endPool } from '../server/lib/postgres';

import { PORT, NANO_PORT } from './config';
import { setupNanoMockServer } from './mock';

let server;
let nanoMockServer;

beforeAll(async () => {

    await postQuery(`delete from transaction;`);
    
    server = await new Promise((resolve, reject) => {
        let svr = app.listen(PORT, err => {
            return (err || !svr) ? reject(err) : resolve(svr);
        });
    });

    nanoMockServer = await new Promise((resolve, reject) => {
        let svr = setupNanoMockServer().listen(NANO_PORT, err => {
            return (err || !svr) ? reject(err) : resolve(svr);
        });
    });

}, 5000);

afterAll(async () => {
    await endPool();

    if (server) {
        await new Promise((resolve, reject) => {
            return server.close(err => {
                return err ? reject(err) : resolve();
            });
        });
    }

    if (nanoMockServer) {
        await new Promise((resolve, reject) => {
            return nanoMockServer.close(err => {
                return err ? reject(err) : resolve();
            });
        });
    }
}, 10000);