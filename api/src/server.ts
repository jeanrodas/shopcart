import { env } from './config/env.js';
import app from './app.js';
import { getPool, closePool } from './config/db.js';
import { logger } from './config/logger.js';
import { asegurarCarpetaUploads } from './config/uploads.js';
import { iniciarJobReservas, detenerJobReservas } from './jobs/liberarReservas.js';

async function main(): Promise<void> {
  // Carpeta de subidas (F2): se crea si no existe antes de atender peticiones.
  asegurarCarpetaUploads();

  // Valida la conexion a la BD antes de empezar a escuchar.
  await getPool();

  const server = app.listen(env.PORT, () => {
    logger.info(`[server] ShopCart API escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
  });

  // Job de liberacion de reservas vencidas (arranca tras escuchar).
  iniciarJobReservas();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`[server] ${signal} recibido, cerrando...`);
    detenerJobReservas();
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, '[server] Fallo al iniciar el servidor');
  process.exit(1);
});
