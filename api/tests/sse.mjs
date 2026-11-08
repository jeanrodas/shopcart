/**
 * Prueba de flujo SSE (F9), solo HTTP. Verifica que al completar una compra, el stream
 * de eventos del area interna recibe `pedido.creado` en menos de 2 s.
 *
 * Secuencia:
 *   1) Admin abre GET /eventos con un ticket y espera el evento inicial "hola"
 *      (a partir de ahi el listener del bus esta suscrito).
 *   2) Un cliente hace el checkout completo (carrito -> iniciar -> pagar aprobado).
 *   3) Se comprueba que llega `pedido.creado` con el numero del pedido creado.
 *
 * No usa SQL ni dependencias: fetch + ReadableStream de Node 18+. Requiere la API en
 * :3000 (BASE_URL para cambiarla) y la BD sembrada.
 *
 * Uso:  node api/tests/sse.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const V1 = `${BASE}/api/v1`;

function log(...a) {
  console.log('[sse]', ...a);
}

async function jsonFetch(ruta, opc = {}) {
  const res = await fetch(`${V1}${ruta}`, opc);
  const texto = await res.text();
  let cuerpo = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = texto;
  }
  return { status: res.status, cuerpo, headers: res.headers };
}

async function login(correo, contrasena) {
  const r = await jsonFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
  if (r.status !== 200 || !r.cuerpo?.accessToken) {
    throw new Error(`login ${correo} fallo (${r.status})`);
  }
  return r.cuerpo.accessToken;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Abre el stream SSE y resuelve con un controlador para esperar eventos por tipo. */
async function abrirStream(ticket) {
  const ctrl = new AbortController();
  const res = await fetch(`${V1}/eventos?ticket=${ticket}`, {
    headers: { Accept: 'text/event-stream' },
    signal: ctrl.signal,
  });
  if (res.status !== 200) throw new Error(`GET /eventos devolvio ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const esperas = new Map(); // tipo -> {resolve}
  const recibidos = [];
  let buffer = '';

  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const bloque = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (bloque.startsWith(':')) continue; // comentario (ping)
          let tipo = 'message';
          let data = '';
          for (const linea of bloque.split('\n')) {
            if (linea.startsWith('event:')) tipo = linea.slice(6).trim();
            else if (linea.startsWith('data:')) data += linea.slice(5).trim();
          }
          let datos = null;
          try {
            datos = data ? JSON.parse(data) : null;
          } catch {
            datos = data;
          }
          recibidos.push({ tipo, datos });
          const w = esperas.get(tipo);
          if (w) {
            esperas.delete(tipo);
            w.resolve({ tipo, datos });
          }
        }
      }
    } catch {
      /* stream abortado al cerrar: normal */
    }
  })();

  return {
    esperar(tipo, ms) {
      const ya = recibidos.find((e) => e.tipo === tipo);
      if (ya) return Promise.resolve(ya);
      return new Promise((resolve, reject) => {
        esperas.set(tipo, { resolve });
        setTimeout(() => {
          if (esperas.has(tipo)) {
            esperas.delete(tipo);
            reject(new Error(`timeout esperando evento "${tipo}" (${ms} ms)`));
          }
        }, ms);
      });
    },
    cerrar() {
      ctrl.abort();
    },
  };
}

async function comprarComoCliente() {
  const token = await login('cliente2@shopcart.local', 'Cliente123!');
  const h = { ...auth(token), 'Content-Type': 'application/json' };

  // Carrito limpio para un punto de partida conocido.
  await jsonFetch('/carrito', { method: 'DELETE', headers: auth(token) });

  // Direccion de entrega: usa la primera; si no hay, crea una.
  let dir = await jsonFetch('/direcciones', { headers: auth(token) });
  let idDireccion = Array.isArray(dir.cuerpo) ? dir.cuerpo[0]?.IDDireccion : dir.cuerpo?.[0]?.id;
  if (!idDireccion && Array.isArray(dir.cuerpo) && dir.cuerpo[0]) {
    idDireccion = dir.cuerpo[0].id ?? dir.cuerpo[0].IDDireccion;
  }
  if (!idDireccion) {
    const creada = await jsonFetch('/direcciones', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        alias: 'Casa', nombreReceptor: 'Cliente Dos', telefono: '55555555',
        linea1: 'Zona 1 Ciudad', municipio: 'Guatemala', departamento: 'Guatemala',
      }),
    });
    idDireccion = creada.cuerpo?.id ?? creada.cuerpo?.IDDireccion;
  }
  if (!idDireccion) throw new Error('no se pudo obtener/crear una direccion');

  // Agrega una variante de alto stock (idVariante 3) para no competir con las pruebas de UI
  // del producto 1; hace checkout + pago aprobado.
  const add = await jsonFetch('/carrito/items', {
    method: 'POST', headers: h, body: JSON.stringify({ idVariante: 3, cantidad: 1 }),
  });
  if (add.status >= 400) throw new Error(`agregar al carrito fallo (${add.status})`);

  const ini = await jsonFetch('/checkout/iniciar', {
    method: 'POST', headers: h, body: JSON.stringify({ idDireccion }),
  });
  if (ini.status >= 400) throw new Error(`iniciar checkout fallo (${ini.status})`);

  const clave = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pago = await jsonFetch('/checkout/pagar', {
    method: 'POST',
    headers: { ...h, 'Idempotency-Key': clave },
    body: JSON.stringify({ idDireccion, metodoPago: 'EFECTIVO', simularResultado: 'APROBADO' }),
  });
  if (pago.status !== 201) throw new Error(`pagar fallo (${pago.status}): ${JSON.stringify(pago.cuerpo)}`);
  return pago.cuerpo?.pedido?.NumeroPedido ?? '(desconocido)';
}

/**
 * Prueba de fuga: abre 10 streams y los aborta de inmediato (durante el await inicial del
 * handler); comprueba via /eventos/diagnostico (solo NODE_ENV=test) que no quedan conexiones
 * ni suscriptores huerfanos. Si el diagnostico no esta (API no en modo test), se omite.
 */
async function leakTest(adminToken) {
  const diag0 = await jsonFetch('/eventos/diagnostico');
  if (diag0.status === 404) {
    log('diagnostico no disponible (API no esta en NODE_ENV=test): se omite la prueba de fuga');
    return;
  }
  const base = diag0.cuerpo;
  const abiertos = [];
  for (let i = 0; i < 10; i++) {
    const tk = await jsonFetch('/eventos/ticket', { method: 'POST', headers: auth(adminToken) });
    const ctrl = new AbortController();
    const p = fetch(`${V1}/eventos?ticket=${tk.cuerpo.ticket}`, {
      headers: { Accept: 'text/event-stream' },
      signal: ctrl.signal,
    }).catch(() => null);
    abiertos.push({ ctrl, p });
  }
  // Recibidos los headers, abortar de inmediato (el handler esta en su await inicial).
  for (const s of abiertos) {
    const r = await s.p;
    try { await r?.body?.cancel?.(); } catch { /* abortado */ }
    s.ctrl.abort();
  }
  await new Promise((r) => setTimeout(r, 1500)); // deja correr los 'close'
  const diag1 = await jsonFetch('/eventos/diagnostico');
  log('fuga SSE: antes', JSON.stringify(base), '-> despues', JSON.stringify(diag1.cuerpo));
  if (diag1.cuerpo.conexiones !== 0) throw new Error(`quedaron ${diag1.cuerpo.conexiones} conexiones SSE`);
  if (diag1.cuerpo.suscriptores > base.suscriptores) {
    throw new Error(`fuga de suscriptores: ${base.suscriptores} -> ${diag1.cuerpo.suscriptores}`);
  }
  log('OK: sin fuga de listeners/intervals tras 10 abort inmediatos');
}

async function main() {
  const admin = await login('admin@shopcart.local', 'Admin123!');
  await leakTest(admin);
  const tk = await jsonFetch('/eventos/ticket', { method: 'POST', headers: auth(admin) });
  if (tk.status !== 201 || !tk.cuerpo?.ticket) throw new Error(`ticket fallo (${tk.status})`);
  log('ticket obtenido');

  const stream = await abrirStream(tk.cuerpo.ticket);
  const hola = await stream.esperar('hola', 3000);
  log('evento "hola" recibido; estado inicial operacion:', JSON.stringify(hola.datos?.operacion));

  const esperaCreado = stream.esperar('pedido.creado', 2000);
  const t0 = Date.now();
  const numero = await comprarComoCliente();
  log('compra completada, pedido', numero);

  const evt = await esperaCreado;
  const ms = Date.now() - t0;
  log(`evento "pedido.creado" recibido en ${ms} ms:`, JSON.stringify(evt.datos));
  stream.cerrar();

  if (ms >= 2000) throw new Error(`el evento tardo ${ms} ms (>= 2000)`);
  log('OK: pedido.creado llego en menos de 2 s');
  process.exit(0);
}

main().catch((err) => {
  console.error('[sse] FALLO:', err.message);
  process.exit(1);
});
