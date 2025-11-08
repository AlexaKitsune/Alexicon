// utils/dbSetup.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function createDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8').replace(/\$\$/g, ';');

    try {
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS || '',
            multipleStatements: true,
        });

        await conn.query(sql);
        await conn.end();
        console.log('Base de datos y tablas creadas (si no existían).');
    } catch (err) {
        console.error('Error al crear la base de datos:', err);
    }
}

module.exports = createDatabase;