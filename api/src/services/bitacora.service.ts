import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import type {
  ListarBitacoraQuery,
  BitacoraPorRegistroQuery,
} from '../schemas/bitacora.schema.js';

export async function consultar(q: ListarBitacoraQuery): Promise<{
  filas: unknown[];
  total: number;
  pagina: number;
  tamano: number;
}> {
  const result = await executeSp('SP_Bitacora_Consultar', [
    { name: 'Modulo', type: sql.NVarChar(50), value: q.modulo ?? null },
    { name: 'Entidad', type: sql.NVarChar(100), value: q.entidad ?? null },
    { name: 'IDEntidad', type: sql.Int, value: q.idEntidad ?? null },
    { name: 'IDUsuario', type: sql.Int, value: q.idUsuario ?? null },
    { name: 'Accion', type: sql.NVarChar(20), value: q.accion ?? null },
    { name: 'Desde', type: sql.DateTime2(0), value: q.desde ? new Date(q.desde) : null },
    { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta ? new Date(q.hasta) : null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamano },
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'Orden', type: sql.NVarChar(40), value: q.orden ?? null },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion ?? null },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamano: q.tamano };
}

/** Todos los eventos de un registro (@Tabla = Entidad, @IDRegistro = IDEntidad). */
export async function porRegistro(q: BitacoraPorRegistroQuery): Promise<{ filas: unknown[] }> {
  const result = await executeSp('SP_Bitacora_ListarPorRegistro', [
    { name: 'Tabla', type: sql.NVarChar(100), value: q.tabla },
    { name: 'IDRegistro', type: sql.Int, value: q.idRegistro },
  ]);
  return { filas: (result.recordset as unknown[]) ?? [] };
}

export async function modulos(): Promise<string[]> {
  const result = await executeSp('SP_Bitacora_Modulos', []);
  return (result.recordset as Array<{ Modulo: string }>).map((r) => r.Modulo);
}
