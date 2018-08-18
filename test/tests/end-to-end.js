/* @flow */

import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

import { URL } from '../config';

jest.setTimeout(60000); // eslint-disable-line no-undef

test('Should run a successful transaction in chrome', async () => {

    if (process.env.CI) {
        return;
    }

    let browser = await puppeteer.launch();
    let page = await browser.newPage();
    await page.goto(`${ URL }/blank`);

    await page.setContent(`<div id="nano-button"></div>`);

    let pageErr;

    page.on('pageerror', (err) => {
        pageErr = err;
    });

    await page.waitFor('#nano-button');
    await page.addScriptTag({ url: 'https://brainblocks.io/brainblocks.min.js' });

    let renderPromise = page.evaluate(() => {
        return window.brainblocks.Button.render({
            env:     'local',
            payment: {
                destination: 'xrb_1brainb3zz81wmhxndsbrjb94hx3fhr1fyydmg6iresyk76f3k7y7jiazoji',
                currency:    'rai',
                amount:      '1'
            },
            onPayment(data) {
                window.resolveOnPayment(data.token);
            }
        }, '#nano-button');
    });

    let tokenPromise = page.evaluate(() => {
        return new Promise((resolve) => {
            window.resolveOnPayment = resolve;
        });
    });

    if (pageErr) {
        throw pageErr;
    }

    await renderPromise;

    await page.waitFor('iframe[name^=xcomponent__brainblocks_button]');
    
    let frame = page.frames().find(f => f.name().match(/^xcomponent__brainblocks_button/));

    if (!frame) {
        throw new Error(`Can not find nano button frame`);
    }
    
    await frame.waitFor('.brainblocks-button');
    await frame.click('.brainblocks-button');

    await frame.waitFor('#brainblocks-checkout-account');

    let token = await tokenPromise;

    let res = await fetch(`${ URL }/api/session/${ token }/verify`);

    if (res.status !== 200) {
        throw new Error(`Expected 200 response, got ${ res.status }`);
    }

    let json = await res.json();

    if (!json.token) {
        throw new Error(`Expected token to be returned from api`);
    }

    if (json.token !== token) {
        throw new Error(`Expected token to be ${ token }, got ${ json.token }`);
    }

    if (!json.destination) {
        throw new Error(`Expected destination to be returned from api`);
    }

    if (!json.currency) {
        throw new Error(`Expected currency to be returned from api`);
    }

    if (!json.amount) {
        throw new Error(`Expected amount to be returned from api`);
    }

    if (!json.amount_rai) {
        throw new Error(`Expected amount_rai to be returned from api`);
    }

    if (!json.received_rai) {
        throw new Error(`Expected received_rai to be returned from api`);
    }

    if (!json.fulfilled) {
        throw new Error(`Expected fulfilled to be returned from api`);
    }

    if (!json.send_block) {
        throw new Error(`Expected send_block to be returned from api`);
    }

    if (!json.sender) {
        throw new Error(`Expected sender to be returned from api`);
    }

    await browser.close();
});
