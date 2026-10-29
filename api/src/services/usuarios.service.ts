import bcrypt from 'bcryptjs';
import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import type { ListarUsuariosQuery } from '../schemas/usuarios.schema.js';

const BCRYPT_COST = 10;

interface CrearUsuarioInput {
  correo: string;
  contrasena: string;
  nombre: string;
  idRol: number;
}

export async function listar(q: ListarUsuariosQuery): Promise<{
  filas: unknown[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}> {
  const result = await executeSp('SP_Usuarios_Listar', [
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'IDRol', type: sql.Int, value: q.idRol ?? null },
    { name: 'Activo', type: sql.Bit, value: q.activo ?? null },
    { name: 'Orden', type: sql.NVarChar(30), value: q.orden },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
}

export async function crear(input: CrearUsuarioInput, actorId: number): Promise<unknown> {
  const hash = await bcrypt.hash(input.contrasena, BCRYPT_COST);
  const result = await executeSp('SP_Usuarios_Crear', [
    { name: 'Correo', type: sql.NVarChar(255), value: input.correo },
    { name: 'HashContrasena', type: sql.NVarChar(255), value: hash },
    { name: 'Nombre', type: sql.NVarChar(150), value: input.nombre },
    { name: 'IDRol', type: sql.Int, value: input.idRol },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function cambiarRol(
  idUsuario: number,
  idRol: number,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Usuarios_CambiarRol', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'IDRol', type: sql.Int, value: idRol },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function cambiarEstado(
  idUsuario: number,
  activo: boolean,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Usuarios_CambiarEstado', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'Activo', type: sql.Bit, value: activo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}
