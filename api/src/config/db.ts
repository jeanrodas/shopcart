import sql from 'mssql';
import { env } from './env.js';
import { logger } from './logger.js';

const config: sql.config = {
  server: env.DB_SERVER,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  requestTimeout: env.DB_REQUEST_TIMEOUT_MS,
  options: {
    encrypt: env.DB_ENCRYPT,
    trustServerCertificate: env.DB_TRUST_SERVER_CERT,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (connecting) return connecting;

  const candidate = new sql.ConnectionPool(config);
  candidate.on('error', (err: unknown) => {
    logger.error({ err }, '[db] error en el pool de conexiones');
  });

  connecting = candidate
    .connect()
    .then(() => {
      pool = candidate;
      connecting = null;
      return candidate;
    })
    .catch((err: unknown) => {
      connecting = null;
      throw err;
    });

  return connecting;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
