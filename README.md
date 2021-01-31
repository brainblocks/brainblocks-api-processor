# brainblocks-site

Repo for the brainblocks core platform and api

To setup you local environment, view the guide [here](https://gist.github.com/schenkty/f4b2dcdf6b5c517862ea3940ecd410d4)

CircleCI Build Status

[![CircleCI](https://circleci.com/gh/brainblocks/brainblocks-site.svg?style=shield&circle-token=d0c1976aa816b7b4f44ced21de40cdb1ec797377)](https://circleci.com/gh/brainblocks/brainblocks-site)

## Dependencies

Requires a full nano node to be run.

## Terminology

API Server: exposes /api/* endpoints which client apps can talk to
Processor: loops and processes nano transactions and refunds

## Quick Start

Install npm modules:

```bash
npm install
```

Start API Server

```bash
npm start
```

Start processor

```bash
npm run start:processor
```

## Configuration

See `server/config.js`
