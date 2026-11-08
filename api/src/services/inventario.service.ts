import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { invalidarTodo } from '../utils/reportesCache.js';
import { emitir } from '../eventos/bus.js';
import type {
  EntradaInput,
  AjusteInput,
  ExistenciasQuery,
  KardexQuery,
  InventarioAdminQuery,
  SimularInput,
} from '../schemas/inventario.schema.js';

// El backend solo envia los parametros expuestos: el SP aplica sus valores por
// defecto para el resto (origen no interno y sin pedido asociado). Los tipos
// reservados al sistema quedan asi fuera del alcance del backend.

interface MovimientoRow {
  CodigoTipo: string;
  Cantidad: number;
  Disponible: number;
}
interface EstadoVarianteRow {
  SKU: string;
  Disponible: number;
  Umbral: number;
  BajoStock: boolean;
}

/**
 * Tras confirmar un movimiento, emite el evento SSE inventario.movimiento (y
 * inventario.bajoStock si la variante quedo en o bajo el umbral). El evento tambien
 * invalida el cache de reportes (via bus). El SKU/umbral vienen de un SP de solo
 * lectura (028), nunca de SQL en TypeScript.
 */
async function emitirMovimiento(idVariante: number, mov: MovimientoRow | undefined): Promise<void> {
  if (!mov) {
    invalidarTodo(); // caso defensivo: sin fila del SP, se invalida igual
    return;
  }
  const est = await executeSp<EstadoVarianteRow>('SP_Eventos_EstadoVariante', [
    { name: 'IDVariante', type: sql.Int, value: idVariante },
  ]);
  const e = est.recordset[0];
  const sku = e?.SKU ?? '';
  const disponible = e?.Disponible ?? mov.Disponible;
  emitir('inventario.movimiento', { sku, tipo: mov.CodigoTipo, cantidad: mov.Cantidad, disponible });
  if (e?.BajoStock) emitir('inventario.bajoStock', { sku, disponible, umbral: e.Umbral });
}

export async function registrarEntrada(datos: EntradaInput, actorId: number): Promise<unknown> {
  // El motivo es opcional en una entrada; el SP de M3 exige >= 3 chars, por eso se pone un
  // valor por defecto cuando no viene (sin modificar el SP evaluado).
  const motivo = datos.motivo && datos.motivo.trim().length >= 3 ? datos.motivo : 'Entrada de compra';
  const result = await executeSp<MovimientoRow>('SP_Inventario_RegistrarMovimiento', [
    { name: 'IDVariante', type: sql.Int, value: datos.idVariante },
    { name: 'CodigoTipo', type: sql.NVarChar(30), value: 'ENTRADA_COMPRA' },
    { name: 'Cantidad', type: sql.Int, value: datos.cantidad },
    { name: 'Motivo', type: sql.NVarChar(300), value: motivo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  // Cambia la existencia: emite el evento (que invalida el cache de reportes).
  await emitirMovimiento(datos.idVariante, result.recordset[0]);
  return result.recordset[0];
}

export async function registrarAjuste(datos: AjusteInput, actorId: number): Promise<unknown> {
  const result = await executeSp<MovimientoRow>('SP_Inventario_RegistrarMovimiento', [
    { name: 'IDVariante', type: sql.Int, value: datos.idVariante },
    { name: 'CodigoTipo', type: sql.NVarChar(30), value: datos.tipo },
    { name: 'Cantidad', type: sql.Int, value: datos.cantidad },
    { name: 'Motivo', type: sql.NVarChar(300), value: datos.motivo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  await emitirMovimiento(datos.idVariante, result.recordset[0]);
  return result.recordset[0];
}

export async function listarExistencias(q: ExistenciasQuery): Promise<{
  filas: unknown[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}> {
  const result = await executeSp('SP_Inventario_ListarExistencias', [
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'IDCategoria', type: sql.Int, value: q.idCategoria ?? null },
    { name: 'SoloBajoStock', type: sql.Bit, value: q.soloBajoStock },
    { name: 'IncluirInactivas', type: sql.Bit, value: q.incluirInactivas },
    { name: 'Orden', type: sql.NVarChar(30), value: q.orden },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
}

export async function listarKardex(
  idVariante: number,
  q: KardexQuery,
): Promise<{
  resumen: unknown;
  filas: unknown[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}> {
  const result = await executeSp('SP_Inventario_ListarKardex', [
    { name: 'IDVariante', type: sql.Int, value: idVariante },
    { name: 'Desde', type: sql.DateTime2(0), value: q.desde ? new Date(q.desde) : null },
    { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta ? new Date(q.hasta) : null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  const resumen = result.recordsets[2]?.[0] ?? null;
  return { resumen, filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
}

/**
 * Listado de operacion por variante (F2). Aditivo: SP nuevo (026), no toca M3.
 * Recordsets: (1) filas, (2) Total.
 */
export async function listarAdmin(q: InventarioAdminQuery): Promise<{
  filas: unknown[];
  total: number;
  pagina: number;
  tamano: number;
}> {
  const result = await executeSp('SP_Inventario_ListarAdmin', [
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'IDCategoria', type: sql.Int, value: q.idCategoria ?? null },
    { name: 'Filtro', type: sql.NVarChar(20), value: q.filtro ?? null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'Tamano', type: sql.Int, value: q.tamano },
    { name: 'IDProducto', type: sql.Int, value: q.idProducto ?? null },
    { name: 'Orden', type: sql.NVarChar(40), value: q.orden ?? null },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion ?? null },
  ]);
  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamano: q.tamano };
}

/** KPIs del tablero de inventario (F2). Recordsets: (1) resumen, (2) movimientos de hoy por tipo. */
export async function resumenInventario(): Promise<{
  resumen: unknown;
  movimientosHoy: unknown[];
}> {
  const result = await executeSp('SP_Inventario_Resumen', []);
  const resumen = (result.recordsets[0]?.[0] ?? null) as unknown;
  const movimientosHoy = (result.recordsets[1] ?? []) as unknown[];
  return { resumen, movimientosHoy };
}

/** Vista previa (solo lectura) de un movimiento: Permitido + Motivo (F2). */
export async function simularMovimiento(datos: SimularInput): Promise<unknown> {
  const result = await executeSp('SP_Inventario_SimularMovimiento', [
    { name: 'IDVariante', type: sql.Int, value: datos.idVariante },
    { name: 'Tipo', type: sql.NVarChar(30), value: datos.tipo },
    { name: 'Cantidad', type: sql.Int, value: datos.cantidad },
  ]);
  return result.recordset[0];
}

export async function verificarConsistencia(): Promise<{
  inconsistencias: unknown[];
  totalVariantes: number;
  variantesInconsistentes: number;
  consistente: boolean;
}> {
  const result = await executeSp('SP_Inventario_VerificarConsistencia', []);

  const inconsistencias = (result.recordsets[0] ?? []) as unknown[];
  const resumen = result.recordsets[1]?.[0] as
    | { TotalVariantes: number; VariantesInconsistentes: number }
    | undefined;
  const totalVariantes = resumen?.TotalVariantes ?? 0;
  const variantesInconsistentes = resumen?.VariantesInconsistentes ?? 0;
  return {
    inconsistencias,
    totalVariantes,
    variantesInconsistentes,
    consistente: variantesInconsistentes === 0,
  };
}
