import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { invalidarTodo } from '../utils/reportesCache.js';
import { emitir } from '../eventos/bus.js';
import { ROLES } from '../config/roles.js';
import type { DevolucionInput, ListarPedidosQuery } from '../schemas/pedidos.schema.js';

interface DevolucionRow {
  IDDevolucion: number;
}
interface DevLineaRow {
  IDDevolucion: number;
}

export interface Pedido {
  pedido: unknown | null;
  lineas: unknown[];
  historial: unknown[];
  devoluciones: Array<Record<string, unknown> & { lineas: unknown[] }>;
}

interface PaginaPedidos {
  filas: unknown[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

/** Construye el TVP dbo.TVP_DevolucionLinea a partir de las lineas del body. */
function tvpLineas(lineas: DevolucionInput['lineas']): sql.Table {
  const tvp = new sql.Table('dbo.TVP_DevolucionLinea');
  tvp.columns.add('IDPedidoDetalle', sql.Int, { nullable: false });
  tvp.columns.add('Cantidad', sql.Int, { nullable: false });
  for (const l of lineas) {
    tvp.rows.add(l.idPedidoDetalle, l.cantidad);
  }
  return tvp;
}

/** Arma el pedido a partir de los 5 recordsets de SP_Pedidos_Obtener. */
function ensamblarPedido(recordsets: unknown[][]): Pedido {
  const pedido = (recordsets[0]?.[0] ?? null) as unknown | null;
  const lineas = (recordsets[1] ?? []) as unknown[];
  const historial = (recordsets[2] ?? []) as unknown[];
  const devolucionesRows = (recordsets[3] ?? []) as DevolucionRow[];
  const devLineas = (recordsets[4] ?? []) as DevLineaRow[];

  const devoluciones = devolucionesRows.map((d) => ({
    ...d,
    lineas: devLineas.filter((l) => l.IDDevolucion === d.IDDevolucion),
  }));

  return { pedido, lineas, historial, devoluciones };
}

/**
 * Listado de pedidos. El Cliente usa SP_Pedidos_ListarCliente (tarjeta enriquecida:
 * CantidadLineas/Unidades, hasta 3 imagenes y resumen de nombres, filtro de estado por
 * lista separada por comas y busqueda por numero). Operador/Admin conservan
 * SP_Pedidos_Listar sin cambios. La respuesta mantiene la misma forma {filas,total,...}.
 */
export async function listar(
  idUsuario: number | null,
  q: ListarPedidosQuery,
  rol: string,
): Promise<PaginaPedidos> {
  const tamano = q.tamano ?? q.tamanoPagina;

  if (rol === ROLES.Cliente) {
    const result = await executeSp('SP_Pedidos_ListarCliente', [
      { name: 'IDUsuario', type: sql.Int, value: idUsuario },
      { name: 'CodigoEstado', type: sql.NVarChar(200), value: q.estado ?? null },
      { name: 'Numero', type: sql.NVarChar(30), value: q.numero ?? q.texto ?? null },
      { name: 'Pagina', type: sql.Int, value: q.pagina },
      { name: 'Tamano', type: sql.Int, value: tamano },
      { name: 'Orden', type: sql.NVarChar(4), value: q.orden ?? null },
    ]);
    const filas = (result.recordsets[0] ?? []) as unknown[];
    const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
    return { filas, total, pagina: q.pagina, tamanoPagina: tamano };
  }

  // Operador/Administrador: SP_Pedidos_ListarOperacion (026, F2). Aditivo sobre
  // SP_Pedidos_Listar (018, intacto): acepta el estado como lista separada por comas,
  // busca por numero/nombre/correo y agrega columnas de operacion (NombreCliente,
  // Municipio, CantidadLineas/Unidades, MinutosEnEstado). Conserva IDPedido/EstadoCodigo.
  const result = await executeSp('SP_Pedidos_ListarOperacion', [
    { name: 'CodigoEstado', type: sql.NVarChar(200), value: q.estado ?? null },
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'Desde', type: sql.DateTime2(0), value: q.desde ? new Date(q.desde) : null },
    { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta ? new Date(q.hasta) : null },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: tamano },
    { name: 'RecienteDias', type: sql.Int, value: q.recienteDias ?? null },
    { name: 'Orden', type: sql.NVarChar(40), value: q.ordenCol ?? null },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion ?? null },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamanoPagina: tamano };
}

/** Resumen de operacion para el area interna: conteos del flujo y antiguedad del PAGADO mas viejo. */
export async function resumenOperacion(): Promise<unknown | null> {
  const result = await executeSp('SP_Pedidos_ResumenOperacion', []);
  return (result.recordsets[0]?.[0] ?? null) as unknown | null;
}

/** Resumen del cliente para "Mis pedidos": conteos por estado, total comprado y envio en curso. */
export async function resumen(idUsuario: number): Promise<unknown | null> {
  const result = await executeSp('SP_Pedidos_ResumenCliente', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return (result.recordsets[0]?.[0] ?? null) as unknown | null;
}

export async function obtener(
  idPedido: number,
  idUsuario: number | null,
): Promise<Pedido & { pago: unknown | null }> {
  // Obtener primero: valida propiedad y lanza 50404 uniforme si el pedido es ajeno.
  const result = await executeSp('SP_Pedidos_Obtener', [
    { name: 'IDPedido', type: sql.Int, value: idPedido },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  const pedido = ensamblarPedido(result.recordsets as unknown[][]);

  // Pago simulado (metodo, estado, referencia) para la pantalla de detalle.
  const pagoRes = await executeSp('SP_Pedidos_PagoCliente', [
    { name: 'IDPedido', type: sql.Int, value: idPedido },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  const pago = (pagoRes.recordsets[0]?.[0] ?? null) as unknown | null;

  return { ...pedido, pago };
}

export async function cambiarEstado(
  idPedido: number,
  codigoEstadoDestino: string,
  comentario: string | null,
  idUsuarioEjecuta: number,
  rolEjecuta: string,
): Promise<Pedido> {
  const result = await executeSp('SP_Pedidos_CambiarEstado', [
    { name: 'IDPedido', type: sql.Int, value: idPedido },
    { name: 'CodigoEstadoDestino', type: sql.NVarChar(30), value: codigoEstadoDestino },
    { name: 'Comentario', type: sql.NVarChar(300), value: comentario },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: idUsuarioEjecuta },
    { name: 'RolEjecuta', type: sql.NVarChar(30), value: rolEjecuta },
  ]);
  const pedido = ensamblarPedido(result.recordsets as unknown[][]);
  // Un cambio de estado (incluida la cancelacion) altera ventas/inventario netos: emite
  // pedido.estado (que ademas invalida el cache de reportes via el bus). El "de"/"a" y el
  // usuario salen del ultimo renglon del historial que devuelve el SP.
  emitirEstado(idPedido, pedido);
  return pedido;
}

interface HistorialRow {
  EstadoAnteriorCodigo: string | null;
  EstadoNuevoCodigo: string;
  UsuarioNombre: string | null;
}

function emitirEstado(idPedido: number, p: Pedido): void {
  const cab = p.pedido as { NumeroPedido?: string } | null;
  const hist = p.historial as HistorialRow[];
  const ult = hist[hist.length - 1];
  if (!cab || !ult) {
    invalidarTodo(); // caso defensivo: sin datos del historial, se invalida igual
    return;
  }
  emitir('pedido.estado', {
    idPedido,
    numero: cab.NumeroPedido ?? '',
    de: ult.EstadoAnteriorCodigo,
    a: ult.EstadoNuevoCodigo,
    usuario: ult.UsuarioNombre ?? 'sistema',
  });
}

export async function registrarDevolucion(
  idPedido: number,
  datos: DevolucionInput,
  idUsuarioEjecuta: number,
): Promise<Pedido & { devolucion: unknown | null }> {
  const result = await executeSp('SP_Pedidos_RegistrarDevolucion', [
    { name: 'IDPedido', type: sql.Int, value: idPedido },
    { name: 'Motivo', type: sql.NVarChar(300), value: datos.motivo },
    { name: 'Lineas', value: tvpLineas(datos.lineas) },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: idUsuarioEjecuta },
  ]);

  // La devolucion descuenta la venta neta: invalida el cache de reportes.
  invalidarTodo();

  const recordsets = result.recordsets as unknown[][];
  const pedido = ensamblarPedido(recordsets);
  const devolucion = (recordsets[5]?.[0] ?? null) as unknown | null;
  return { ...pedido, devolucion };
}
