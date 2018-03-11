#!/bin/bash

cp ../brainblocks/dist/*.js static/js
cp ../brainblocks/dist/*.js.map static/js

cwd=$(pwd)
cd ~/woocommerce-brainblocks/
zip -r $cwd/static/woocommerce-gateway-brainblocks.zip woocommerce-gateway-brainblocks
cd $cwd

rsync -avzr --exclude=node_modules --exclude=.git . brainblocks@ssh.brainblocks.io:brainblocks
