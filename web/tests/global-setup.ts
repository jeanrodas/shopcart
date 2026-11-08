const API = process.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Chequeo previo a la suite (no toca la BD ni el .env). Si la API responde a /health,
 * hace UN login y avisa por consola si el limitador de /auth ya esta saturado (429): la
 * suite hace ~25 inicios de sesion y login+refresh comparten ese limitador, por lo que con
 * el default de RATE_LIMIT_AUTH_MAX las ultimas pruebas fallarian. Nunca lanza: si la API
 * no esta arriba, deja que cada prueba falle con su propio mensaje.
 */
export default async function globalSetup(): Promise<void> {
  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) return;
  } catch {
    return; // API no disponible: lo reportaran las pruebas
  }

  try {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'admin@shopcart.local', contrasena: 'Admin123!' }),
    });
    if (res.status === 429) {
      console.warn('\n[playwright] Sube RATE_LIMIT_AUTH_MAX a 400 en api/.env para correr la suite\n');
    }
  } catch {
    /* sin red: lo reportaran las pruebas */
  }
}
