#!/bin/bash

set -e

test_db="brainblocks-test";
db="${1-brainblocks}";

if [[ "$db" != $test_db ]]; then
    read -p "This will delete the $db database. Press enter to continue"
    read -p "THIS WILL DELETE THE $db DATABASE. Press enter to continue"
    read -p "THIS WILL DELETE THE $db DATABASE. LAST CHANCE. Press enter to continue"
fi

dropdb "$db" || echo "$db database does not exist"
createdb "$db"

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
   amount_rai   BIGINT                      NOT NULL CHECK (amount_rai > 0),
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

" | psql "$db";
