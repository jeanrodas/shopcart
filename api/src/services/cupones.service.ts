import sql from 'mssql';
import { executeSp, type SpParam } from '../data/spExecutor.js';
import { ensamblarCarrito, type CarritoResultado } from './carrito.service.js';
import type {
  CuponInput,
  ListarCuponesQuery,
  ListarCuponesAdminQuery,
} from '../schemas/cupones.schema.js';

/** Parametros comunes de Crear/Actualizar (las fechas ISO se pasan como Date). */
function cuponParams(datos: CuponInput): SpParam[] {
  return [
    { name: 'Codigo', type: sql.NVarChar(30), value: datos.codigo },
    { name: 'TipoDescuento', type: sql.NVarChar(10), value: datos.tipoDescuento },
    { name: 'Valor', type: sql.Decimal(18, 2), value: datos.valor },
    { name: 'IDCategoria', type: sql.Int, value: datos.idCategoria ?? null },
    { name: 'MontoMinimo', type: sql.Decimal(18, 2), value: datos.montoMinimo },
    { name: 'FechaInicio', type: sql.DateTime2, value: new Date(datos.fechaInicio) },
    { name: 'FechaFin', type: sql.DateTime2, value: new Date(datos.fechaFin) },
    { name: 'LimiteUsosTotal', type: sql.Int, value: datos.limiteUsosTotal ?? null },
    { name: 'LimiteUsosPorCliente', type: sql.Int, value: datos.limiteUsosPorCliente ?? null },
  ];
}

/* ------------------------------- Carrito ---------------------------------- */

export async function aplicarACarrito(idUsuario: number, codigo: string): Promise<CarritoResultado> {
  const result = await executeSp('SP_Cupones_AplicarACarrito', [
    { name: 'Codigo', type: sql.NVarChar(30), value: codigo },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: idUsuario },
  ]);
  return ensamblarCarrito(result.recordsets as unknown[][]);
}

export async function quitarDeCarrito(idUsuario: number): Promise<CarritoResultado> {
  const result = await executeSp('SP_Cupones_QuitarDeCarrito', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: idUsuario },
  ]);
  return ensamblarCarrito(result.recordsets as unknown[][]);
}

/** Valida un codigo contra el carrito del cliente sin guardarlo (lanza si falla). */
export async function validar(idUsuario: number, codigo: string): Promise<unknown> {
  const result = await executeSp('SP_Cupones_Validar', [
    { name: 'Codigo', type: sql.NVarChar(30), value: codigo },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return result.recordset[0] ?? null;
}

/* ------------------------------- Publico (tienda) ------------------------- */

/** Cupones vigentes para la tienda. Nunca expone limites ni usos (ver SP). */
export async function vigentes(): Promise<{ cupones: unknown[] }> {
  const result = await executeSp('SP_Cupones_Vigentes', []);
  return { cupones: result.recordset };
}

/* ---------------------------- CRUD Administrador -------------------------- */

export async function listar(q: ListarCuponesQuery): Promise<{
  filas: unknown[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}> {
  const result = await executeSp('SP_Cupones_Listar', [
    { name: 'Texto', type: sql.NVarChar(50), value: q.texto ?? null },
    { name: 'Activo', type: sql.Bit, value: q.activo ?? null },
    { name: 'SoloVigentes', type: sql.Bit, value: q.soloVigentes },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
}

/** Listado de administracion (F8): estado derivado, alcance y dias para vencer. */
export async function listarAdmin(q: ListarCuponesAdminQuery): Promise<{
  filas: unknown[];
  total: number;
  pagina: number;
  tamano: number;
}> {
  const result = await executeSp('SP_Cupones_ListarAdmin', [
    { name: 'Texto', type: sql.NVarChar(50), value: q.texto ?? null },
    { name: 'Filtro', type: sql.NVarChar(20), value: q.filtro ?? null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'Tamano', type: sql.Int, value: q.tamano },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamano: q.tamano };
}

/** KPIs del panel de administracion de cupones (F8). */
export async function resumenAdmin(): Promise<unknown> {
  const result = await executeSp('SP_Cupones_ResumenAdmin', []);
  return result.recordset[0] ?? null;
}

export async function obtener(idCupon: number): Promise<unknown> {
  const result = await executeSp('SP_Cupones_Obtener', [
    { name: 'IDCupon', type: sql.Int, value: idCupon },
  ]);
  return result.recordset[0];
}

export async function crear(datos: CuponInput, actorId: number): Promise<unknown> {
  const result = await executeSp('SP_Cupones_Crear', [
    ...cuponParams(datos),
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function actualizar(
  idCupon: number,
  datos: CuponInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Cupones_Actualizar', [
    { name: 'IDCupon', type: sql.Int, value: idCupon },
    ...cuponParams(datos),
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function cambiarEstado(
  idCupon: number,
  activo: boolean,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Cupones_CambiarEstado', [
    { name: 'IDCupon', type: sql.Int, value: idCupon },
    { name: 'Activo', type: sql.Bit, value: activo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}
