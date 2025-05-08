const fs = require('fs');
const path = require('path');
const pool = require('./dbIndex');

async function createDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    try {
        const connection = await pool.getConnection();
        await connection.query(sql.replace(/\$\$/g, ';')); // reemplaza `$$` por `;` para ejecutarlo
        console.log('Base de datos y tablas creadas (si no existían).');
        connection.release();
    } catch (err) {
        console.error('Error al crear la base de datos:', err);
    }
}

module.exports = createDatabase;
