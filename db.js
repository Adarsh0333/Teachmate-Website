const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'portal_db',
    port: 3307 // Add this line
});

module.exports = pool.promise();