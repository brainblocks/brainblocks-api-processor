#!/bin/bash

set -e

read -p 'This will delete the database. Press enter to continue'
read -p 'THIS WILL DELETE THE DATABASE. Press enter to continue'
read -p 'THIS WILL DELETE THE DATABASE. LAST CHANCE. Press enter to continue'

dropdb brainblocks || echo 'BrainBlocks database does not exist'
createdb brainblocks

echo "

CREATE EXTENSION pgcrypto;

CREATE TABLE transaction(
   id           UUID                         PRIMARY KEY DEFAULT gen_random_uuid(),
   created      TIMESTAMP WITH TIME ZONE     DEFAULT now(),
   modified     TIMESTAMP WITH TIME ZONE     DEFAULT now(),
   status       VARCHAR(100)                 NOT NULL CHECK (status <> ''),
   wallet       VARCHAR(100)                 NOT NULL CHECK (wallet <> ''),
   account      VARCHAR(100)                 NOT NULL CHECK (account <> ''),
   private      VARCHAR(100)                 NOT NULL CHECK (private <> ''),
   public       VARCHAR(100)                 NOT NULL CHECK (public <> ''),
   destination  VARCHAR(100)                 NOT NULL CHECK (destination <> ''),
   amount       VARCHAR(30)                  NOT NULL CHECK (amount <> ''),
   amount_rai   INTEGER                      NOT NULL CHECK (amount_rai > 0),
   currency     VARCHAR(5)                   NOT NULL CHECK (currency <> '')
);

CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.modified = now();
    RETURN NEW;   
END;
\$\$ language 'plpgsql';

CREATE TRIGGER update_transaction_modtime
    BEFORE UPDATE ON transaction
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

" | psql brainblocks;