import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import type { DireccionInput } from '../schemas/direcciones.schema.js';

function camposDireccion(d: DireccionInput): Array<{
  name: string;
  type: sql.ISqlType;
  value: unknown;
}> {
  return [
    { name: 'Alias', type: sql.NVarChar(50), value: d.alias },
    { name: 'NombreReceptor', type: sql.NVarChar(150), value: d.nombreReceptor },
    { name: 'Telefono', type: sql.NVarChar(20), value: d.telefono },
    { name: 'Linea1', type: sql.NVarChar(200), value: d.linea1 },
    { name: 'Linea2', type: sql.NVarChar(200), value: d.linea2 ?? null },
    { name: 'Municipio', type: sql.NVarChar(100), value: d.municipio },
    { name: 'Departamento', type: sql.NVarChar(100), value: d.departamento },
    { name: 'CodigoPostal', type: sql.NVarChar(10), value: d.codigoPostal ?? null },
    { name: 'Referencia', type: sql.NVarChar(300), value: d.referencia ?? null },
  ];
}

export async function listar(idUsuario: number): Promise<unknown[]> {
  const result = await executeSp('SP_Direcciones_Listar', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return result.recordset;
}

export async function obtener(idDireccion: number, idUsuario: number): Promise<unknown> {
  const result = await executeSp('SP_Direcciones_Obtener', [
    { name: 'IDDireccion', type: sql.Int, value: idDireccion },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return result.recordset[0];
}

export async function crear(
  idUsuario: number,
  datos: DireccionInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Direcciones_Crear', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    ...camposDireccion(datos),
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function actualizar(
  idDireccion: number,
  idUsuario: number,
  datos: DireccionInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Direcciones_Actualizar', [
    { name: 'IDDireccion', type: sql.Int, value: idDireccion },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    ...camposDireccion(datos),
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function desactivar(
  idDireccion: number,
  idUsuario: number,
  actorId: number,
): Promise<void> {
  await executeSp('SP_Direcciones_Desactivar', [
    { name: 'IDDireccion', type: sql.Int, value: idDireccion },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
}
