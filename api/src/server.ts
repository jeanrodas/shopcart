import { env } from './config/env.js';
import app from './app.js';
import { getPool, closePool } from './config/db.js';
import { iniciarJobReservas, detenerJobReservas } from './jobs/liberarReservas.js';

async function main(): Promise<void> {
  // Valida la conexion a la BD antes de empezar a escuchar.
  await getPool();

  const server = app.listen(env.PORT, () => {
    console.log(`[server] ShopCart API escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
  });

  // Job de liberacion de reservas vencidas (arranca tras escuchar).
  iniciarJobReservas();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} recibido, cerrando...`);
    detenerJobReservas();
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] Fallo al iniciar el servidor:', err);
  process.exit(1);
});
