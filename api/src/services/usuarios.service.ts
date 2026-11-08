import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import type {
  ListarUsuariosQuery,
  ListarUsuariosAdminQuery,
} from '../schemas/usuarios.schema.js';

const BCRYPT_COST = 10;

interface CrearUsuarioInput {
  correo: string;
  contrasena?: string;
  nombre: string;
  idRol: number;
}

// Charset sin caracteres ambiguos (0/O, 1/l/I) para que la clave temporal sea facil de
// dictar. Siempre cumple la politica (>= 12, con letra y numero) por construccion.
const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const SIMBOLOS = '@#$%*?';

/**
 * Contrasena temporal de 14 caracteres con aleatoriedad de crypto (randomInt, sin sesgo).
 * Garantiza al menos una mayuscula, una minuscula, un digito y un simbolo, y mezcla el
 * resto. Se devuelve UNA sola vez al crear; nunca se registra en logs ni en la bitacora.
 */
export function generarContrasenaTemporal(): string {
  const todos = MAYUS + MINUS + DIGITOS + SIMBOLOS;
  const chars = [
    MAYUS[randomInt(MAYUS.length)],
    MINUS[randomInt(MINUS.length)],
    DIGITOS[randomInt(DIGITOS.length)],
    SIMBOLOS[randomInt(SIMBOLOS.length)],
  ];
  for (let i = chars.length; i < 14; i += 1) chars.push(todos[randomInt(todos.length)]);
  // Fisher-Yates para que los 4 obligatorios no queden siempre al inicio.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Perfil del usuario autenticado (Mi cuenta). */
export async function obtenerPerfil(idUsuario: number): Promise<unknown> {
  const result = await executeSp('SP_Usuarios_ObtenerPerfil', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return result.recordset[0] ?? null;
}

/** Actualiza el propio nombre y telefono (nunca correo ni rol). Devuelve el perfil nuevo. */
export async function actualizarPerfil(
  idUsuario: number,
  nombre: string,
  telefono: string | null,
): Promise<unknown> {
  const result = await executeSp('SP_Usuarios_ActualizarPerfil', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'Nombre', type: sql.NVarChar(150), value: nombre },
    { name: 'Telefono', type: sql.NVarChar(30), value: telefono },
  ]);
  return result.recordset[0] ?? null;
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
  // Si el admin no manda contrasena, el servidor genera una temporal y la devuelve una
  // sola vez (nunca se registra: pino no loggea cuerpos y dbo.Usuario no se audita).
  const temporal = input.contrasena ? null : generarContrasenaTemporal();
  const hash = await bcrypt.hash(input.contrasena ?? (temporal as string), BCRYPT_COST);
  const result = await executeSp('SP_Usuarios_Crear', [
    { name: 'Correo', type: sql.NVarChar(255), value: input.correo },
    { name: 'HashContrasena', type: sql.NVarChar(255), value: hash },
    { name: 'Nombre', type: sql.NVarChar(150), value: input.nombre },
    { name: 'IDRol', type: sql.Int, value: input.idRol },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  const usuario = result.recordset[0] as Record<string, unknown>;
  return temporal ? { ...usuario, contrasenaTemporal: temporal } : usuario;
}

/** Listado de administracion (F8): pedidos, estado de bloqueo y conteos por rol/estado. */
export async function listarAdmin(q: ListarUsuariosAdminQuery): Promise<{
  filas: unknown[];
  total: number;
  conteos: unknown;
  pagina: number;
  tamano: number;
}> {
  const result = await executeSp('SP_Usuarios_ListarAdmin', [
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'IDRol', type: sql.Int, value: q.idRol ?? null },
    { name: 'Filtro', type: sql.NVarChar(20), value: q.filtro ?? null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'Tamano', type: sql.Int, value: q.tamano },
    { name: 'Orden', type: sql.NVarChar(40), value: q.orden ?? null },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion ?? null },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  const conteos = (result.recordsets[2]?.[0] as unknown) ?? null;
  return { filas, total, conteos, pagina: q.pagina, tamano: q.tamano };
}

export async function desbloquear(idUsuario: number, actorId: number): Promise<unknown> {
  const result = await executeSp('SP_Usuarios_Desbloquear', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
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
