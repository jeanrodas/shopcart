/*
 * Prueba de rendimiento de los reportes (M9, RF-08). Node 24 puro, sin dependencias.
 * Solo HTTP contra la API: no toca la base de datos directamente.
 *
 * Uso:
 *   node tests/rendimiento.mjs
 *   BASE_URL=http://localhost:3000 npm run test:rendimiento
 *
 * Requiere la API corriendo y la base sembrada (099) con admin@shopcart.local /
 * Admin123!. Como hace muchas llamadas seguidas, correr la API con
 * RATE_LIMIT_AUTH_MAX alto no es necesario (solo 1 login), pero los reportes son de
 * Administrador.
 *
 * Fase BASE (rendimiento puro de los SPs): para medir el costo real del SP y no el
 * del cache, correr con el cache DESACTIVADO:
 *   REPORTES_CACHE_TTL_SEGUNDOS=0  (ver .env.example)
 * Con el cache activo la primera llamada es MISS y el resto HIT (muy rapidas), por lo
 * que la fase base no reflejaria el SP. El script avisa si detecta HIT en la fase base.
 *
 * Fase CACHE: repite las mismas llamadas y reporta la proporcion de X-Cache: HIT
 * (con el cache activo deberia ser ~19/20 por reporte; con TTL=0 sera 0).
 *
 * Sale con codigo 1 si el p95 de algun reporte en la fase base es >= 1000 ms.
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;
const REPETICIONES = 20;
const UMBRAL_MS = 1000;

const ADMIN = { correo: 'admin@shopcart.local', contrasena: 'Admin123!' };

function iso(d) {
  return d.toISOString();
}

// Rango: ultimos 90 dias.
const AHORA = new Date();
const HACE_90 = new Date(AHORA.getTime() - 90 * 24 * 60 * 60 * 1000);
const DESDE = iso(HACE_90);
const HASTA = iso(AHORA);

const REPORTES = [
  { nombre: 'resumen', path: `/reportes/resumen?desde=${DESDE}&hasta=${HASTA}` },
  { nombre: 'ventas-DIA', path: `/reportes/ventas?desde=${DESDE}&hasta=${HASTA}&agrupacion=DIA` },
  { nombre: 'ventas-SEMANA', path: `/reportes/ventas?desde=${DESDE}&hasta=${HASTA}&agrupacion=SEMANA` },
  { nombre: 'ventas-MES', path: `/reportes/ventas?desde=${DESDE}&hasta=${HASTA}&agrupacion=MES` },
  { nombre: 'categorias', path: `/reportes/categorias?desde=${DESDE}&hasta=${HASTA}` },
  { nombre: 'top-productos', path: `/reportes/top-productos?desde=${DESDE}&hasta=${HASTA}&top=10` },
  { nombre: 'carritos-abandonados', path: `/reportes/carritos-abandonados?pagina=1&tamanoPagina=20` },
];

async function req(method, path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const inicio = performance.now();
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, { method, headers });
  await res.text();
  const ms = performance.now() - inicio;
  return { status: res.status, ms, cache: res.headers.get('x-cache') };
}

async function login(correo, contrasena) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
  const json = await res.json().catch(() => null);
  if (res.status !== 200 || !json?.accessToken) {
    throw new Error(`Login admin fallido: ${res.status} ${JSON.stringify(json)}`);
  }
  return json.accessToken;
}

function percentil(valores, p) {
  const orden = [...valores].sort((a, b) => a - b);
  const idx = Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1);
  return orden[Math.max(0, idx)];
}

async function main() {
  const token = await login(ADMIN.correo, ADMIN.contrasena);

  console.log('\n=== Prueba de rendimiento de reportes (M9) ===');
  console.log(`Rango: ${DESDE} -> ${HASTA}  |  ${REPETICIONES} llamadas por reporte  |  umbral p95 < ${UMBRAL_MS} ms\n`);

  // --- Fase BASE ---
  console.log('--- Fase base (SP) ---');
  let algunHitEnBase = false;
  let algunP95Alto = false;
  const anchoNombre = Math.max(...REPORTES.map((r) => r.nombre.length));

  for (const rep of REPORTES) {
    const latencias = [];
    for (let i = 0; i < REPETICIONES; i++) {
      const r = await req('GET', rep.path, { token });
      if (r.status !== 200) throw new Error(`${rep.nombre}: status ${r.status}`);
      if (r.cache === 'HIT') algunHitEnBase = true;
      latencias.push(r.ms);
    }
    const p50 = percentil(latencias, 50);
    const p95 = percentil(latencias, 95);
    const max = Math.max(...latencias);
    const ok = p95 < UMBRAL_MS;
    if (!ok) algunP95Alto = true;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${rep.nombre.padEnd(anchoNombre)}  ` +
        `p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  max=${max.toFixed(1)}ms`,
    );
  }
  // La fase base debe medir el SP sin cache. Si hubo HIT, la medicion no es valida.
  if (algunHitEnBase) {
    console.error(
      '\nFALLO (exit 2): se observo X-Cache: HIT en la fase base, por lo que las ' +
        'latencias NO reflejan el SP. Corra con REPORTES_CACHE_TTL_SEGUNDOS=0.\n',
    );
    process.exit(2);
  }

  // --- Fase CACHE ---
  console.log('\n--- Fase cache (proporcion de HIT) ---');
  for (const rep of REPORTES) {
    let hits = 0;
    for (let i = 0; i < REPETICIONES; i++) {
      const r = await req('GET', rep.path, { token });
      if (r.status !== 200) throw new Error(`${rep.nombre}: status ${r.status}`);
      if (r.cache === 'HIT') hits++;
    }
    console.log(`${rep.nombre.padEnd(anchoNombre)}  HIT ${hits}/${REPETICIONES}`);
  }

  // --- Fase CONCURRENTE ---
  // 10 llamadas en paralelo por reporte (Promise.all); reporta p95 bajo concurrencia.
  console.log('\n--- Fase concurrente (10 en paralelo) ---');
  const CONC = 10;
  for (const rep of REPORTES.filter((r) => r.nombre === 'resumen' || r.nombre === 'ventas-DIA')) {
    const resultados = await Promise.all(
      Array.from({ length: CONC }, () => req('GET', rep.path, { token })),
    );
    const malos = resultados.filter((r) => r.status !== 200).length;
    if (malos > 0) throw new Error(`${rep.nombre}: ${malos}/${CONC} respuestas != 200 en concurrencia`);
    const lat = resultados.map((r) => r.ms);
    console.log(
      `${rep.nombre.padEnd(anchoNombre)}  p95=${percentil(lat, 95).toFixed(1)}ms  ` +
        `max=${Math.max(...lat).toFixed(1)}ms  (n=${CONC} paralelas)`,
    );
  }

  console.log(
    `\n${algunP95Alto ? 'FALLO' : 'OK'}: ${algunP95Alto ? 'algun p95 >= ' + UMBRAL_MS + ' ms' : 'todos los p95 por debajo del umbral'}.\n`,
  );
  process.exit(algunP95Alto ? 1 : 0);
}

main().catch((err) => {
  console.error('\n[rendimiento] Error de ejecucion:', err.message);
  process.exit(1);
});
