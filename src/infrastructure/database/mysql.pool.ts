import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

/** Pool compartido por los adaptadores de persistencia del backend. */
export const mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'claridad',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'claridad',
    connectionLimit: 10,
    timezone: 'Z',
});
