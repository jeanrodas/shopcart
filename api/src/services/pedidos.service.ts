import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { invalidarTodo } from '../utils/reportesCache.js';
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

export async function listar(
  idUsuario: number | null,
  q: ListarPedidosQuery,
): Promise<{ filas: unknown[]; total: number; pagina: number; tamanoPagina: number }> {
  const result = await executeSp('SP_Pedidos_Listar', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'CodigoEstado', type: sql.NVarChar(30), value: q.estado ?? null },
    { name: 'Desde', type: sql.DateTime2(0), value: q.desde ? new Date(q.desde) : null },
    { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta ? new Date(q.hasta) : null },
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
}

export async function obtener(idPedido: number, idUsuario: number | null): Promise<Pedido> {
  const result = await executeSp('SP_Pedidos_Obtener', [
    { name: 'IDPedido', type: sql.Int, value: idPedido },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return ensamblarPedido(result.recordsets as unknown[][]);
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
  // Un cambio de estado (incluida la cancelacion) altera ventas/inventario netos.
  invalidarTodo();
  return ensamblarPedido(result.recordsets as unknown[][]);
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
