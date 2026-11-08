// Inserta (o reemplaza) la carpeta "00 Recorrido guiado Fase 2" en la coleccion Postman.
// Script de ayuda idempotente: ejecutarlo de nuevo reemplaza la carpeta, no la duplica.
//   node docs/postman/build-recorrido-f2.mjs
// Luego verificar con:
//   npx --yes newman run docs/postman/ShopCart.postman_collection.json \
//     --folder "00 Recorrido guiado Fase 2" --env-var baseUrl=http://localhost:3000
//
// Todos los requests son de SOLO LECTURA o idempotentes (el registro usa un correo con
// {{$guid}}; simular, los listados, el dashboard y el ticket SSE no mutan las semillas),
// asi que la carpeta es repetible sin reinstalar la base.
import { readFileSync, writeFileSync } from 'node:fs';

const RUTA = new URL('./ShopCart.postman_collection.json', import.meta.url);
const col = JSON.parse(readFileSync(RUTA, 'utf8'));

const NOMBRE = '00 Recorrido guiado Fase 2';

/** Atajo para un request con asserts de test. */
const req = (name, method, path, { token, body, test } = {}) => {
  const header = [];
  if (body) header.push({ key: 'Content-Type', value: 'application/json' });
  if (token) header.push({ key: 'Authorization', value: `Bearer {{${token}}}` });
  const request = { method, header, url: `{{baseUrl}}${path}` };
  if (body) request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2) };
  return {
    name,
    event: test ? [{ listen: 'test', script: { type: 'text/javascript', exec: test } }] : [],
    request,
  };
};

const items = [
  req('01 Login admin (setup) — RF-01', 'POST', '/api/v1/auth/login', {
    body: { correo: 'admin@shopcart.local', contrasena: 'Admin123!' },
    test: [
      "pm.test('login admin 200', () => pm.expect(pm.response.code).to.eql(200));",
      'const d = pm.response.json();',
      "pm.collectionVariables.set('rf2Admin', d.accessToken);",
      'const now = new Date();',
      "pm.collectionVariables.set('rf2Hasta', now.toISOString());",
      "pm.collectionVariables.set('rf2Desde', new Date(now.getTime() - 40*24*60*60*1000).toISOString());",
    ],
  }),
  req('02 Login operador (setup) — RF-01', 'POST', '/api/v1/auth/login', {
    body: { correo: 'operador@shopcart.local', contrasena: 'Operador123!' },
    test: [
      "pm.test('login operador 200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.collectionVariables.set('rf2Oper', pm.response.json().accessToken);",
    ],
  }),
  req('03 Registro de cliente — el carrito se conserva al entrar (RF-01, Pantalla 5)', 'POST', '/api/v1/auth/registro', {
    body: { correo: 'rf2-{{$guid}}@shopcart.local', contrasena: 'Cliente123', nombre: 'Cliente Recorrido F2' },
    test: [
      "pm.test('registro 201', () => pm.expect(pm.response.code).to.eql(201));",
      'const d = pm.response.json();',
      "pm.test('rol Cliente', () => pm.expect(d.usuario.rol).to.eql('Cliente'));",
      "pm.collectionVariables.set('rf2Cliente', d.accessToken);",
    ],
  }),
  req('04 Mi cuenta: perfil del cliente (GET /usuarios/me) — F6', 'GET', '/api/v1/usuarios/me', {
    token: 'rf2Cliente',
    test: [
      "pm.test('perfil 200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.test('trae Correo y Nombre', () => { const d = pm.response.json(); pm.expect(d).to.have.property('Correo'); pm.expect(d).to.have.property('Nombre'); });",
    ],
  }),
  req('05 Catalogo de administracion ordenado por precio desc (ordenamiento en servidor) — F6', 'GET', '/api/v1/productos-admin?orden=precio&direccion=DESC&tamano=20', {
    token: 'rf2Admin',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      'const d = pm.response.json();',
      "pm.test('trae filas y conteos', () => { pm.expect(d.filas).to.be.an('array'); pm.expect(d).to.have.property('conteos'); });",
      "pm.test('precio desc: la 1a fila con precio es el maximo', () => {",
      '  const precios = d.filas.map(f => f.PrecioMinimo).filter(p => p !== null && p !== undefined);',
      '  if (precios.length > 1) pm.expect(precios[0]).to.eql(Math.max(...precios));',
      '});',
    ],
  }),
  req('06 Inventario de operacion ordenado por disponible asc — F7', 'GET', '/api/v1/inventario/admin?orden=disponible&direccion=ASC&tamano=20', {
    token: 'rf2Oper',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      'const d = pm.response.json();',
      "pm.test('trae filas', () => pm.expect(d.filas).to.be.an('array').that.is.not.empty);",
      "pm.collectionVariables.set('rf2Variante', d.filas[0].IDVariante);",
    ],
  }),
  req('07 Simular ajuste negativo mayor al disponible: Permitido=false (RF-03) — F7', 'POST', '/api/v1/inventario/simular', {
    token: 'rf2Oper',
    body: { idVariante: '{{rf2Variante}}', tipo: 'AJUSTE_NEGATIVO', cantidad: 100000 },
    test: [
      "pm.test('200 (solo lectura)', () => pm.expect(pm.response.code).to.eql(200));",
      'const d = pm.response.json();',
      "pm.test('no permitido + motivo', () => { pm.expect(d.Permitido).to.eql(false); pm.expect(d.Motivo).to.be.a('string').and.not.empty; });",
    ],
  }),
  req('08 Cola de pedidos: resumen de operacion — F7', 'GET', '/api/v1/pedidos/resumen-operacion', {
    token: 'rf2Oper',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.test('trae conteos del flujo', () => { const d = pm.response.json(); ['Pagado','EnPreparacion','Despachado'].forEach(k => pm.expect(d).to.have.property(k)); });",
    ],
  }),
  req('09 Dashboard: resumen, primera lectura (X-Cache MISS) — RF-08/F9', 'GET', '/api/v1/dashboard/resumen?desde={{rf2Desde}}&hasta={{rf2Hasta}}', {
    token: 'rf2Admin',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.test('X-Cache MISS', () => pm.expect(pm.response.headers.get('X-Cache')).to.eql('MISS'));",
      "pm.test('4 KPIs con comparativo', () => { const d = pm.response.json(); ['VentasNetas','Pedidos','TicketPromedio','UnidadesVendidas'].forEach(k => pm.expect(d).to.have.property(k)); });",
    ],
  }),
  req('10 Dashboard: resumen, segunda lectura (X-Cache HIT) — extra: cache', 'GET', '/api/v1/dashboard/resumen?desde={{rf2Desde}}&hasta={{rf2Hasta}}', {
    token: 'rf2Admin',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.test('X-Cache HIT', () => pm.expect(pm.response.headers.get('X-Cache')).to.eql('HIT'));",
    ],
  }),
  req('11 Dashboard: ventas por semana (granularidad SEMANA) — RF-08/F9', 'GET', '/api/v1/dashboard/ventas-dia?desde={{rf2Desde}}&hasta={{rf2Hasta}}&granularidad=SEMANA', {
    token: 'rf2Admin',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.test('serie (array) con Fecha/VentaNeta/Pedidos', () => { const d = pm.response.json(); pm.expect(d).to.be.an('array'); if (d.length) ['Fecha','VentaNeta','Pedidos'].forEach(k => pm.expect(d[0]).to.have.property(k)); });",
    ],
  }),
  req('12 Eventos en vivo: ticket SSE de un solo uso (Admin) — extra: SSE/F9', 'POST', '/api/v1/eventos/ticket', {
    token: 'rf2Admin',
    test: [
      "pm.test('201', () => pm.expect(pm.response.code).to.eql(201));",
      "pm.test('trae ticket', () => pm.expect(pm.response.json().ticket).to.be.a('string').and.not.empty);",
    ],
  }),
  req('13 Un cliente NO puede pedir ticket SSE (403) — F9', 'POST', '/api/v1/eventos/ticket', {
    token: 'rf2Cliente',
    test: ["pm.test('403', () => pm.expect(pm.response.code).to.eql(403));"],
  }),
  req('14 Cupones de administracion con estado derivado — F8', 'GET', '/api/v1/cupones/admin', {
    token: 'rf2Admin',
    test: [
      "pm.test('200', () => pm.expect(pm.response.code).to.eql(200));",
      "pm.test('trae filas con EstadoDerivado', () => { const d = pm.response.json(); pm.expect(d.filas).to.be.an('array'); if (d.filas.length) pm.expect(d.filas[0]).to.have.property('EstadoDerivado'); });",
    ],
  }),
  req('15 Bitacora: el Operador no accede (403) — RF-09/F8', 'GET', '/api/v1/bitacora?modulo=PRODUCTOS', {
    token: 'rf2Oper',
    test: ["pm.test('403 (bitacora es solo Administrador)', () => pm.expect(pm.response.code).to.eql(403));"],
  }),
];

const folder = {
  name: NOMBRE,
  description:
    'Recorrido guiado de Fase 2: los 15 requests que respaldan los recorridos de ' +
    'docs/GUIA-EVALUACION-FASE2.md (cliente, operador y administrador). Solo lectura/idempotente, ' +
    'repetible sin reinstalar la base. Ejecutar de arriba hacia abajo (los primeros tres fijan los ' +
    'tokens por rol). Requiere los RATE_LIMIT_*_MAX=100 de api/.env.example.',
  item: items,
};

// Idempotente: quita una version previa y la inserta tras el recorrido de Fase 1.
col.item = col.item.filter((i) => i.name !== NOMBRE);
const iFase1 = col.item.findIndex((i) => i.name === '00 Recorrido guiado');
col.item.splice(iFase1 >= 0 ? iFase1 + 1 : 0, 0, folder);

// Conserva el formato del archivo (tabulador + CRLF) para un diff limpio.
const salida = JSON.stringify(col, null, '\t').replace(/\n/g, '\r\n');
writeFileSync(RUTA, salida, 'utf8');
console.log(`OK: carpeta "${NOMBRE}" con ${items.length} requests insertada.`);
