const API = process.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Chequeo previo a la suite (no toca la BD ni el .env). Si la API responde a /health:
 *  1) Hace UN login y avisa si el limitador de /auth ya está saturado (429): la suite hace
 *     ~25 inicios de sesión y login+refresh comparten ese limitador.
 *  2) Lee la fecha de instalación de la BD del evento SSE "hola" (SP_Sistema_Instalacion) y
 *     avisa si tiene más de 60 min: las semillas pueden estar mutadas por corridas previas y
 *     conviene reinstalar (`npm run test:e2e`). Todo es advisory: nunca lanza.
 */
export default async function globalSetup(): Promise<void> {
  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) return;
  } catch {
    return; // API no disponible: lo reportarán las pruebas
  }

  let token: string | null = null;
  try {
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'admin@shopcart.local', contrasena: 'Admin123!' }),
    });
    if (res.status === 429) {
      console.warn('\n[playwright] Sube RATE_LIMIT_AUTH_MAX a 400 en api/.env para correr la suite\n');
      return;
    }
    if (res.ok) token = ((await res.json()) as { accessToken?: string }).accessToken ?? null;
  } catch {
    return;
  }

  if (!token) return;
  try {
    const instalacion = await leerInstalacion(token);
    if (instalacion) {
      const edadMin = (Date.now() - Date.parse(instalacion)) / 60_000;
      if (Number.isFinite(edadMin) && edadMin > 60) {
        console.warn(
          `\n[playwright] La BD se instaló hace ~${Math.round(edadMin)} min (>60): las semillas pueden ` +
            'estar mutadas por corridas previas. Ejecuta "npm run test:e2e" para reinstalar antes de la suite.\n',
        );
      }
    }
  } catch {
    /* advisory: sin instalación disponible, no se avisa */
  }
}

/** Abre el stream SSE un instante y devuelve el campo `instalacion` del evento "hola". */
async function leerInstalacion(token: string): Promise<string | null> {
  const tk = await fetch(`${API}/api/v1/eventos/ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!tk.ok) return null;
  const ticket = ((await tk.json()) as { ticket?: string }).ticket;
  if (!ticket) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${API}/api/v1/eventos?ticket=${encodeURIComponent(ticket)}`, {
      headers: { Accept: 'text/event-stream' },
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const bloque = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        if (!bloque.includes('event: hola')) continue;
        const linea = bloque.split('\n').find((l) => l.startsWith('data:'));
        if (!linea) return null;
        const datos = JSON.parse(linea.slice(5).trim()) as { instalacion?: string };
        return datos.instalacion ?? null;
      }
    }
    return null;
  } finally {
    clearTimeout(timer);
    ctrl.abort();
  }
}
