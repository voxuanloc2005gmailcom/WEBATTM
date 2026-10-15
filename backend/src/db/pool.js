import pg from 'pg';

const { Pool } = pg;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export const dbConfig = {
  host: required('DB_HOST'),
  port: Number(process.env.DB_PORT || 5432),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'techgear-api'
};

export const pool = new Pool(dbConfig);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function pingDatabase() {
  await pool.query('SELECT 1');
}

