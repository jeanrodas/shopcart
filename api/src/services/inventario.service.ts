import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { invalidarTodo } from '../utils/reportesCache.js';
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

export async function registrarEntrada(datos: EntradaInput, actorId: number): Promise<unknown> {
  const result = await executeSp('SP_Inventario_RegistrarMovimiento', [
    { name: 'IDVariante', type: sql.Int, value: datos.idVariante },
    { name: 'CodigoTipo', type: sql.NVarChar(30), value: 'ENTRADA_COMPRA' },
    { name: 'Cantidad', type: sql.Int, value: datos.cantidad },
    { name: 'Motivo', type: sql.NVarChar(300), value: datos.motivo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  // Cambia la existencia: invalida el cache de reportes (productos bajo stock).
  invalidarTodo();
  return result.recordset[0];
}

export async function registrarAjuste(datos: AjusteInput, actorId: number): Promise<unknown> {
  const result = await executeSp('SP_Inventario_RegistrarMovimiento', [
    { name: 'IDVariante', type: sql.Int, value: datos.idVariante },
    { name: 'CodigoTipo', type: sql.NVarChar(30), value: datos.tipo },
    { name: 'Cantidad', type: sql.Int, value: datos.cantidad },
    { name: 'Motivo', type: sql.NVarChar(300), value: datos.motivo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  invalidarTodo();
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
