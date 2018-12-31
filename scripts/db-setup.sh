#!/bin/bash

set -e

test_db="brainblocks-test";
db="${1-brainblocks}";
host= $2 || "localhost";

if [[ "$db" != $test_db ]]; then
    read -p "This will delete the $db database. Press enter to continue"
    read -p "THIS WILL DELETE THE $db DATABASE. Press enter to continue"
    read -p "THIS WILL DELETE THE $db DATABASE. LAST CHANCE. Press enter to continue"
fi

dropdb -h $host "$db" || echo "$db database does not exist on $host"
createdb -h $host "$db"

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

CREATE TABLE paypal_transaction(
   id           UUID                         PRIMARY KEY DEFAULT gen_random_uuid(),
   created      TIMESTAMP WITH TIME ZONE     DEFAULT now(),
   modified     TIMESTAMP WITH TIME ZONE     DEFAULT now(),
   status       VARCHAR(100)                 NOT NULL CHECK (status <> ''),
   email        VARCHAR(100)                 NOT NULL CHECK (status <> ''),
   amount       VARCHAR(30)                  NOT NULL CHECK (amount <> ''),
   currency     VARCHAR(5)                   NOT NULL CHECK (currency <> ''),
   payment_id   VARCHAR(30)                  NOT NULL CHECK (amount <> '')
);

CREATE TABLE precache(
   id           UUID                         DEFAULT gen_random_uuid(),
   created      TIMESTAMP WITH TIME ZONE     DEFAULT now(),
   modified     TIMESTAMP WITH TIME ZONE     DEFAULT now(),
   account      VARCHAR(100)                 NOT NULL CHECK (account <> ''),
   private      VARCHAR(100)                 NOT NULL CHECK (private <> ''),
   public       VARCHAR(100)                 NOT NULL CHECK (public <> '')
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

CREATE TRIGGER paypal_transaction_modtime
    BEFORE UPDATE ON transaction
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

" | psql -h $host "$db";
