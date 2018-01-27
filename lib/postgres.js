const { Pool } = require('pg');

let { DATABASE } = require('../config');

const pool = new Pool({
    host: DATABASE.HOST,
    user: DATABASE.USER,
    database: DATABASE.NAME,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function postQuery(text, values = []) {
    let client = await pool.connect();
    console.warn(text, values);
    let result = await client.query(text, values);
    client.release()
    console.warn(result.rows);
    return result.rows;
}

async function postQuerySingle(text, values = []) {
    let rows = await postQuery(text, values);
    if (rows.length > 1) {
        throw new Error(`Expected single result for query: ${ text }, ${ JSON.stringify(values) }`);
    }
    return rows[0];
}

async function postInsert(table, data) {
    let keys = Object.keys(data);
    let values = keys.map(key => data[key]);

    let query = `
        INSERT INTO ${table} (${ keys.join(', ') })
            VALUES (${ keys.map((val, i) => `$${ (i + 1).toString() }`).join(', ') })
            RETURNING id;
    `;
    
    return await postQuerySingle(query, values);
}

async function postSelect(table, criteria, columns = [ 'id' ]) {

    let keys = Object.keys(criteria);
    let values = keys.map(key => criteria[key]);

    let query = `
        SELECT ${ columns.join(', ') }
            FROM ${ table }
            WHERE ${ keys.map((key, i) => `${ key } = $${ i + 1 }`).join(' AND ') };
    `;

    return await postQuery(query, values);
}

async function postSelectOne(table, criteria, columns = [ 'id' ]) {
    
    let rows = await postSelect(table, criteria, columns);

    if (rows.length > 1) {
        throw new Error(`Expected single result for query: ${ JSON.stringify(criteria) }`);
    }

    return rows[0];
}
    

async function postSelectID(table, id, columns = [ 'id' ]) {
    return await postSelectOne(table, { id }, columns);
}

async function postUpdateWhere(table, criteria, data) {
    
    let keys = Object.keys(data);
    let values = keys.map(key => data[key]);

    let criteriaKeys = Object.keys(criteria);
    let criteriaValues = criteriaKeys.map(key => criteria[key]);

    let query = `
        UPDATE ${ table }
            SET ${ keys.map((key, i) => `${ key } = $${ i + 1 }`).join(', ') }
            WHERE (${ criteriaKeys.map((key, i) => `${ key } = $${ keys.length + i + 1 }`).join(' AND ') })
            AND (${ keys.map((key, i) => `${ key } != $${ i + 1 }`).join(' OR ') });
    `;

    return await postQuerySingle(query, [ ...values, ...criteriaValues ]);
}

async function postUpdateID(table, id, data) {
    return await postUpdateWhere(table, { id }, data);
}


module.exports = { postQuery, postQuerySingle, postInsert,
    postSelect, postSelectOne, postSelectID, postUpdateWhere, postUpdateID };