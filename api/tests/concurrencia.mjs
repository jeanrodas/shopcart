/*
 * Prueba de concurrencia del checkout (M6, RF-06). Node 24 puro, sin dependencias.
 * Solo HTTP contra la API: no toca la base de datos directamente.
 *
 * Uso:
 *   node tests/concurrencia.mjs            (BASE_URL=http://localhost:3000 por defecto)
 *   BASE_URL=http://localhost:3000 npm run test:concurrencia
 *
 * Requiere la API corriendo y la base sembrada (099) con el usuario
 * admin@shopcart.local / Admin123!. Como registra 10 clientes + login admin en
 * pocos segundos, ejecute la API con RATE_LIMIT_AUTH_MAX alto (p.ej. 100); con el
 * valor por defecto (10) el limitador devolvera 429 durante el alta de clientes.
 * El escenario (g) necesita PAGO_SIMULADO=true (si no, el backend fuerza APROBADO).
 * Cada usuario hace a lo sumo 3 operaciones de checkout, por debajo del default
 * RATE_LIMIT_CHECKOUT_MAX=20; si se baja ese limite, correr con
 * RATE_LIMIT_CHECKOUT_MAX=100.
 *
 * Escenarios:
 *   (c) 10 POST /checkout/iniciar en paralelo -> 1x201 y 9x409.
 *   (d) 2 POST /checkout/pagar del ganador con la MISMA Idempotency-Key ->
 *       ambos 201, mismo NumeroPedido, exactamente uno con replay=true.
 *   (e) GET /inventario/consistencia -> consistente=true.
 *   (f) un perdedor reintenta /checkout/iniciar -> 409.
 *   (g) pago RECHAZADO -> 402 con monto numerico; reintento APROBADO con clave
 *       nueva -> 201 (variante y cliente dedicados).
 *   (h) cliente B reutiliza la clave de A -> 409 sin campo pedido en el body.
 *   (i) tras el pedido del ganador, GET /inventario/existencias de la variante
 *       en contienda -> Existencia=0 y Reservado=0.
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE_URL}/api/v1`;
const SUFIJO = Date.now().toString(36);
const N_CLIENTES = 10;

const ADMIN = { correo: 'admin@shopcart.local', contrasena: 'Admin123!' };

async function req(method, path, { token, body, headers } = {}) {
  const h = { 'Content-Type': 'application/json', ...(headers ?? {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json };
}

function nuevaClave() {
  // Clave de idempotencia valida: 16-100 [A-Za-z0-9_-].
  return `conc-${SUFIJO}-${globalThis.crypto.randomUUID()}`;
}

function fallarSi429(r, contexto) {
  if (r.status === 429) {
    throw new Error(
      `Rate limit (429) en ${contexto}. Reinicie la API con RATE_LIMIT_AUTH_MAX alto (p.ej. 100).`,
    );
  }
}

async function login(correo, contrasena) {
  const r = await req('POST', '/auth/login', { body: { correo, contrasena } });
  fallarSi429(r, 'login');
  if (r.status !== 200 || !r.json?.accessToken) {
    throw new Error(`Login fallido para ${correo}: ${r.status} ${JSON.stringify(r.json)}`);
  }
  return r.json.accessToken;
}

async function registrar(correo, contrasena, nombre) {
  const r = await req('POST', '/auth/registro', { body: { correo, contrasena, nombre } });
  fallarSi429(r, 'registro de cliente');
  if (r.status !== 201 || !r.json?.accessToken) {
    throw new Error(`Registro fallido para ${correo}: ${r.status} ${JSON.stringify(r.json)}`);
  }
  return r.json.accessToken;
}

async function setup() {
  const adminToken = await login(ADMIN.correo, ADMIN.contrasena);

  // (a) Catalogo + 1 unidad de existencia.
  const cat = await req('POST', '/categorias', {
    token: adminToken,
    body: { nombre: `Concurrencia ${SUFIJO}` },
  });
  if (cat.status !== 201) throw new Error(`Crear categoria: ${cat.status} ${JSON.stringify(cat.json)}`);
  const idCategoria = cat.json.IDCategoria;

  const prod = await req('POST', '/productos', {
    token: adminToken,
    body: { idCategoria, nombre: `Producto concurrencia ${SUFIJO}` },
  });
  if (prod.status !== 201) throw new Error(`Crear producto: ${prod.status} ${JSON.stringify(prod.json)}`);
  const idProducto = prod.json.IDProducto;

  const varr = await req('POST', `/productos/${idProducto}/variantes`, {
    token: adminToken,
    body: { sku: `CONC-${SUFIJO}`, precio: 100.0, atributos: [] },
  });
  if (varr.status !== 201) throw new Error(`Crear variante: ${varr.status} ${JSON.stringify(varr.json)}`);
  // La creacion de variante responde { variante, atributos }; el ID vive en variante.
  const idVariante = varr.json.variante.IDVariante;

  const entrada = await req('POST', '/inventario/entradas', {
    token: adminToken,
    body: { idVariante, cantidad: 1, motivo: `Carga concurrencia ${SUFIJO}` },
  });
  if (entrada.status !== 201) throw new Error(`Entrada inventario: ${entrada.status} ${JSON.stringify(entrada.json)}`);

  // (b) 10 clientes, cada uno con 1 unidad en su carrito y una direccion.
  const clientes = [];
  for (let i = 0; i < N_CLIENTES; i++) {
    const correo = `conc_${SUFIJO}_${i}@shopcart.local`;
    const token = await registrar(correo, 'Password123', `Cliente Concurrencia ${i}`);

    const item = await req('POST', '/carrito/items', { token, body: { idVariante, cantidad: 1 } });
    if (item.status !== 201) throw new Error(`Agregar item (cliente ${i}): ${item.status} ${JSON.stringify(item.json)}`);

    const dir = await req('POST', '/direcciones', {
      token,
      body: {
        alias: 'Casa',
        nombreReceptor: `Cliente Concurrencia ${i}`,
        telefono: '+502 5555-0000',
        linea1: '1a Calle 2-34 Zona 1',
        municipio: 'Guatemala',
        departamento: 'Guatemala',
      },
    });
    if (dir.status !== 201) throw new Error(`Crear direccion (cliente ${i}): ${dir.status} ${JSON.stringify(dir.json)}`);

    clientes.push({ token, idDireccion: dir.json.IDDireccion });
  }

  return { adminToken, idProducto, idVariante, clientes };
}

/**
 * (g) Variante nueva con 1 unidad y un cliente dedicado: el stock del escenario de
 * contienda ya se agoto, asi que el flujo RECHAZADO -> APROBADO necesita el suyo.
 */
async function prepararEscenarioRechazo(adminToken, idProducto) {
  const sku = `CONC2-${SUFIJO}`;
  const varr = await req('POST', `/productos/${idProducto}/variantes`, {
    token: adminToken,
    body: { sku, precio: 50.0, atributos: [] },
  });
  if (varr.status !== 201) throw new Error(`Crear variante (g): ${varr.status} ${JSON.stringify(varr.json)}`);
  const idVariante = varr.json.variante.IDVariante;

  const entrada = await req('POST', '/inventario/entradas', {
    token: adminToken,
    body: { idVariante, cantidad: 1, motivo: `Carga rechazo ${SUFIJO}` },
  });
  if (entrada.status !== 201) throw new Error(`Entrada inventario (g): ${entrada.status} ${JSON.stringify(entrada.json)}`);

  const token = await registrar(`conc_g_${SUFIJO}@shopcart.local`, 'Password123', 'Cliente Rechazo');
  const item = await req('POST', '/carrito/items', { token, body: { idVariante, cantidad: 1 } });
  if (item.status !== 201) throw new Error(`Agregar item (g): ${item.status} ${JSON.stringify(item.json)}`);

  const dir = await req('POST', '/direcciones', {
    token,
    body: {
      alias: 'Casa',
      nombreReceptor: 'Cliente Rechazo',
      telefono: '+502 5555-0000',
      linea1: '1a Calle 2-34 Zona 1',
      municipio: 'Guatemala',
      departamento: 'Guatemala',
    },
  });
  if (dir.status !== 201) throw new Error(`Crear direccion (g): ${dir.status} ${JSON.stringify(dir.json)}`);

  return { idVariante, token, idDireccion: dir.json.IDDireccion };
}

async function main() {
  const resultados = [];
  const check = (nombre, ok, detalle) => resultados.push({ nombre, ok, detalle });

  const { adminToken, idProducto, idVariante, clientes } = await setup();

  // (c) 10 iniciar en paralelo: 1x201, 9x409.
  const iniciar = await Promise.all(
    clientes.map((c) => req('POST', '/checkout/iniciar', { token: c.token, body: { idDireccion: c.idDireccion } })),
  );
  const n201 = iniciar.filter((r) => r.status === 201).length;
  const n409 = iniciar.filter((r) => r.status === 409).length;
  check(
    '(c) 10 checkout/iniciar en paralelo -> 1x201 y 9x409',
    n201 === 1 && n409 === 9,
    `201=${n201}, 409=${n409}`,
  );

  const idxGanador = iniciar.findIndex((r) => r.status === 201);
  if (idxGanador === -1) {
    check('(d) pago del ganador', false, 'no hubo ganador (ningun 201 en iniciar)');
    return imprimir(resultados);
  }
  const ganador = clientes[idxGanador];

  // (d) 2 pagos en paralelo con la MISMA clave.
  const clave = nuevaClave();
  const cuerpoPago = { idDireccion: ganador.idDireccion, metodoPago: 'TARJETA', simularResultado: 'APROBADO' };
  const pagos = await Promise.all([
    req('POST', '/checkout/pagar', { token: ganador.token, headers: { 'Idempotency-Key': clave }, body: cuerpoPago }),
    req('POST', '/checkout/pagar', { token: ganador.token, headers: { 'Idempotency-Key': clave }, body: cuerpoPago }),
  ]);
  const ambos201 = pagos.every((r) => r.status === 201);
  const numeros = pagos.map((r) => r.json?.pedido?.NumeroPedido ?? null);
  const mismoNumero = numeros[0] !== null && numeros[0] === numeros[1];
  const replays = pagos.map((r) => r.json?.replay === true);
  const unReplay = replays.filter(Boolean).length === 1;
  check(
    '(d) 2 pagos misma clave -> ambos 201, mismo NumeroPedido, un replay',
    ambos201 && mismoNumero && unReplay,
    `status=${pagos.map((r) => r.status).join('/')}, numeros=${numeros.join('/')}, replay=${replays.join('/')}`,
  );

  // (e) Consistencia del inventario.
  const cons = await req('GET', '/inventario/consistencia', { token: adminToken });
  check(
    '(e) inventario/consistencia -> consistente=true',
    cons.status === 200 && cons.json?.consistente === true,
    `status=${cons.status}, consistente=${cons.json?.consistente}`,
  );

  // (f) Un perdedor reintenta iniciar -> 409.
  const idxPerdedor = iniciar.findIndex((r) => r.status === 409);
  const perdedor = clientes[idxPerdedor];
  const reintento = await req('POST', '/checkout/iniciar', {
    token: perdedor.token,
    body: { idDireccion: perdedor.idDireccion },
  });
  check('(f) perdedor reintenta checkout/iniciar -> 409', reintento.status === 409, `status=${reintento.status}`);

  // (g) Pago RECHAZADO -> 402 con monto numerico; reintento APROBADO con clave nueva -> 201.
  const g = await prepararEscenarioRechazo(adminToken, idProducto);
  const iniG = await req('POST', '/checkout/iniciar', { token: g.token, body: { idDireccion: g.idDireccion } });
  const cuerpoG = { idDireccion: g.idDireccion, metodoPago: 'TARJETA' };
  const rechazo = await req('POST', '/checkout/pagar', {
    token: g.token,
    headers: { 'Idempotency-Key': nuevaClave() },
    body: { ...cuerpoG, simularResultado: 'RECHAZADO' },
  });
  const reintentoAprob = await req('POST', '/checkout/pagar', {
    token: g.token,
    headers: { 'Idempotency-Key': nuevaClave() },
    body: { ...cuerpoG, simularResultado: 'APROBADO' },
  });
  check(
    '(g) pago RECHAZADO -> 402 (monto numerico) y reintento APROBADO -> 201',
    iniG.status === 201 &&
      rechazo.status === 402 &&
      typeof rechazo.json?.pago?.Monto === 'number' &&
      reintentoAprob.status === 201,
    `iniciar=${iniG.status}, rechazo=${rechazo.status}, monto=${rechazo.json?.pago?.Monto}, aprobado=${reintentoAprob.status}`,
  );

  // (h) Cliente B reutiliza la clave de A (la del ganador en (d)) -> 409 sin pedido.
  const idxB = iniciar.findIndex((r, i) => r.status === 409 && i !== idxPerdedor);
  const clienteB = clientes[idxB];
  const pagoB = await req('POST', '/checkout/pagar', {
    token: clienteB.token,
    headers: { 'Idempotency-Key': clave },
    body: { idDireccion: clienteB.idDireccion, metodoPago: 'TARJETA', simularResultado: 'APROBADO' },
  });
  check(
    '(h) cliente B reutiliza la clave de A -> 409 sin campo pedido',
    pagoB.status === 409 && pagoB.json?.pedido === undefined,
    `status=${pagoB.status}, pedido=${pagoB.json?.pedido === undefined ? 'ausente' : 'presente'}`,
  );

  // (i) Tras el pedido del ganador, la variante en contienda queda en 0 / 0.
  const ex = await req('GET', `/inventario/existencias?texto=CONC-${SUFIJO}`, { token: adminToken });
  const fila = Array.isArray(ex.json?.filas)
    ? ex.json.filas.find((f) => f.IDVariante === idVariante)
    : null;
  check(
    '(i) inventario/existencias de la variante -> Existencia=0 y Reservado=0',
    ex.status === 200 && fila != null && fila.Existencia === 0 && fila.Reservado === 0,
    `status=${ex.status}, existencia=${fila?.Existencia}, reservado=${fila?.Reservado}`,
  );

  return imprimir(resultados);
}

function imprimir(resultados) {
  const ancho = Math.max(...resultados.map((r) => r.nombre.length));
  console.log('\n=== Prueba de concurrencia del checkout (M6) ===\n');
  for (const r of resultados) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.nombre.padEnd(ancho)}  ${r.detalle}`);
  }
  const fallidos = resultados.filter((r) => !r.ok).length;
  console.log(`\n${resultados.length - fallidos}/${resultados.length} escenarios en verde.\n`);
  process.exit(fallidos > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n[concurrencia] Error de ejecucion:', err.message);
  process.exit(1);
});
