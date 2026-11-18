import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { runtimeConfig } from './runtime.js';

const database=runtimeConfig.database;
const ssl = database.ssl
  ? { rejectUnauthorized: true, ...(database.caFile ? { ca: readFileSync(database.caFile, 'utf8') } : {}) }
  : undefined;

export const pool = mysql.createPool({
  host: database.host,
  port: database.port,
  user: database.user,
  password: database.password,
  database: database.database,
  connectTimeout: 5000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  dateStrings: true,
  decimalNumbers: true,
  ...(ssl ? { ssl } : {}),
});

// El esquema usa DATETIME sin zona horaria; fija la zona de cada sesión MySQL a Colombia.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '-05:00'");
});

export async function checkDatabase() {
  const [rows] = await pool.query('SELECT DATABASE() AS database_name, 1 AS ok');
  return rows[0];
}
