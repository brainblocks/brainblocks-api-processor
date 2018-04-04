#!/bin/bash

set -e

HOST='52.15.131.220'
RSA_PUB='ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCtNDY9555cp/cjgZOQWtKRWwB3vyAS9tMu505XbzYSSx0GxvFHO0Q9DFQ1WsP1Hb6g3bRC53sZ/lcaQ7s5y7KLQCBTJTrcFUg9S+oqkBjBWjdcxgJ7ZGCkqjkwh1zJYDfLfv8MZrqYrpBCoxfkFqLzeov06T7EOgcwponpJdlNmg2G3itoMwSw/Dt47L0qZ/sPikEj00uRkBKBoPk7o7lmuaCvooQVFp3PLrvSWfRRjbrQmEHi/RH/KfKw6dcz8cL4EcxDoFvmJdIjL4MwJA3FhTQhN0UW3eYBflUO708kjjgZ622ffquiwubOtERIklyxIxZ+7i0ih3AVsjNfjQT5 db@Daniels-MBP';

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

NGINX_TEMPLATE=$(cat "$DIR/templates/nginx.conf");
RAIBLOCKS_INIT_TEMPLATE=$(cat "$DIR/templates/raiblocks.init");
BASHRC_TEMPLATE=$(cat "$DIR/templates/bashrc");
RAIBLOCKS_CONFIG_TEMPLATE=$(cat "$DIR/templates/raiblocks.config.json");

ssh -oStrictHostKeyChecking=no -i $DIR/brainblocks.pem -T "ubuntu@$HOST" << ADD_RSA_TO_EC2_USER

# Add BrainBlocks user
# sudo adduser --disabled-password --gecos "" brainblocks;

# Add RSA key
echo "$RSA_PUB" >> ~/.ssh/authorized_keys;

sudo su - root << ADD_RSA_TO_ROOT_USER

echo "$RSA_PUB" >> ~/.ssh/authorized_keys;

ADD_RSA_TO_ROOT_USER

ADD_RSA_TO_EC2_USER

echo 'woot';

exit 0;

ssh -oStrictHostKeyChecking=no -i $DIR/brainblocks.pem -T "root@$HOST" << EOF1

set -e;

# Install dependencies
sudo add-apt-repository ppa:certbot/certbot -y;
apt update;
apt-get install git cmake g++ curl wget rabbitmq-server nginx postgresql immortal software-properties-common python-certbot-nginx htop;

# Set up Rai Node
wget -O boost_1_66_0.tar.gz http://sourceforge.net/projects/boost/files/boost/1.66.0/boost_1_66_0.tar.gz/download;
tar xzvf boost_1_66_0.tar.gz;
cd boost_1_66_0/;
./bootstrap.sh;
./b2 --prefix=../[boost] link=static install 
cd ..;
git clone --recursive https://github.com/clemahieu/raiblocks.git rai_build;
cd rai_build;
cmake -DBOOST_ROOT=../[boost]/ -G "Unix Makefiles";
make rai_node;
cd ..;
cp -r rai_build ~brainblocks/raiblocks;
echo "$RAIBLOCKS_INIT_TEMPLATE" > /etc/init.d/raiblocks;
chmod +x raiblocks;
mkdir /home/brainblocks/RaiBlocks;
echo "$RAIBLOCKS_CONFIG_TEMPLATE" > /home/brainblocks/RaiBlocks/config.json;
chown brainblocks /home/brainblocks/RaiBlocks -R;
/etc/init.d/raiblocks;

# Set up Nginx
echo "$NGINX_TEMPLATE" > /etc/nginx/sites-enabled/default
service nginx restart

# Set up postgres
sudo su - postgres << EOF4
psql << EOF5
    CREATE USER brainblocks with CREATEDB PASSWORD '***REMOVED***';
    ALTER USER brainblocks WITH SUPERUSER;
EOF5
EOF4

# Set up certbot
certbot --nginx --non-interactive --email=daniel@bluesuncorp.co.uk --agree-toss

# Set up BrainBlocks user
sudo su - brainblocks << EOF2

# Add RSA key
echo "$RSA_PUB" >> ~/.ssh/authorized_keys;

# Install Node
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash
echo "$BASHRC_TEMPLATE" >> ~/.bashrc;
source ~/.bashrc;
nvm install 8;
nvm use 8;
npm install -g pm2;
pm2 install pm2-logrotate;

EOF2

EOF1

cp ~/brainblocks/dist/*.js static/js
cp ~/brainblocks/dist/*.js.map static/js

cwd=$(pwd)
cd ~/woocommerce-brainblocks/
zip -r $cwd/static/woocommerce-gateway-brainblocks.zip woocommerce-gateway-brainblocks
cd $cwd

rsync -avzr --exclude=node_modules --exclude=.git . brainblocks@$HOST:brainblocks

ssh -oStrictHostKeyChecking=no -T "brainblocks@$HOST" << EOF3

set -e;

sleep 20;

pm2 start /home/brainblocks/brainblocks;
pm2 start /home/brainblocks/brainblocks/clean.js;

EOF3