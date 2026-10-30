import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

const BCRYPT_COST = 10;

// Hash dummy de costo equivalente: se compara contra el cuando el correo no
// existe, para que el tiempo de respuesta no revele si el usuario existe.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-shopcart', BCRYPT_COST);

interface UsuarioTokenData {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  IDRol: number;
  Rol: string;
}

interface UsuarioLogin extends UsuarioTokenData {
  HashContrasena: string;
  Activo: boolean;
  IntentosFallidos: number;
  BloqueadoHasta: Date | null;
}

interface SesionResponse {
  accessToken: string;
  refreshToken: string;
  usuario: { id: number; correo: string; nombre: string; rol: string };
}

interface CarritoFusionado {
  lineas: number;
  advertencias: unknown[];
}

function sha256Hex(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/** Convierte una duracion tipo '7d', '15m', '24h', '30s' o segundos a ms. */
function duracionAMs(valor: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(valor.trim());
  if (!match) {
    const segundos = Number(valor);
    return Number.isFinite(segundos) ? segundos * 1000 : 0;
  }
  const cantidad = Number(match[1]);
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]] ?? 0;
  return cantidad * mult;
}

function emitirAccessToken(u: UsuarioTokenData): string {
  return jwt.sign({ sub: u.IDUsuario, rol: u.Rol, nombre: u.Nombre }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

function respuestaSesion(
  u: UsuarioTokenData,
  accessToken: string,
  refreshToken: string,
): SesionResponse {
  return {
    accessToken,
    refreshToken,
    usuario: { id: u.IDUsuario, correo: u.Correo, nombre: u.Nombre, rol: u.Rol },
  };
}

/** Emite un par de tokens y persiste el hash del refresh (alta de token). */
async function emitirParGuardando(u: UsuarioTokenData, ip: string | null): Promise<SesionResponse> {
  const accessToken = emitirAccessToken(u);
  const refreshToken = randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(refreshToken);
  const fechaExpira = new Date(Date.now() + duracionAMs(env.JWT_REFRESH_EXPIRES));

  await executeSp('SP_Auth_GuardarRefreshToken', [
    { name: 'IDUsuario', type: sql.Int, value: u.IDUsuario },
    { name: 'TokenHash', type: sql.Char(64), value: tokenHash },
    { name: 'FechaExpira', type: sql.DateTime2(0), value: fechaExpira },
    { name: 'DireccionIP', type: sql.NVarChar(45), value: ip },
  ]);

  return respuestaSesion(u, accessToken, refreshToken);
}

/**
 * Fusiona el carrito de invitado (X-Cart-Token) en el del usuario tras
 * autenticar. Si no llega token devuelve null; si el token no existe o su
 * carrito no esta activo, el SP no falla y devuelve 0 lineas.
 */
async function fusionarCarritoInvitado(
  idUsuario: number,
  tokenInvitado: string | null,
): Promise<CarritoFusionado | null> {
  if (!tokenInvitado) {
    return null;
  }
  const result = await executeSp('SP_Carrito_Fusionar', [
    { name: 'TokenInvitado', type: sql.UniqueIdentifier, value: tokenInvitado },
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  const advertencias = (result.recordsets[0] ?? []) as unknown[];
  const lineas = (result.recordsets[1] ?? []).length;
  return { lineas, advertencias };
}

export async function registro(
  correo: string,
  contrasena: string,
  nombre: string,
  ip: string | null,
  tokenInvitado: string | null = null,
): Promise<SesionResponse & { carritoFusionado: CarritoFusionado | null }> {
  const hash = await bcrypt.hash(contrasena, BCRYPT_COST);
  const result = await executeSp<UsuarioTokenData>('SP_Auth_RegistrarCliente', [
    { name: 'Correo', type: sql.NVarChar(255), value: correo },
    { name: 'HashContrasena', type: sql.NVarChar(255), value: hash },
    { name: 'Nombre', type: sql.NVarChar(150), value: nombre },
  ]);
  const usuario = result.recordset[0];
  const sesion = await emitirParGuardando(usuario, ip);
  const carritoFusionado = await fusionarCarritoInvitado(usuario.IDUsuario, tokenInvitado);
  return { ...sesion, carritoFusionado };
}

export async function login(
  correo: string,
  contrasena: string,
  ip: string | null,
  tokenInvitado: string | null = null,
): Promise<SesionResponse & { carritoFusionado: CarritoFusionado | null }> {
  const result = await executeSp<UsuarioLogin>('SP_Auth_ObtenerUsuarioPorCorreo', [
    { name: 'Correo', type: sql.NVarChar(255), value: correo },
  ]);
  const u = result.recordset[0];

  if (!u) {
    // Comparacion dummy para igualar tiempos; no revela si el correo existe.
    await bcrypt.compare(contrasena, DUMMY_HASH);
    throw new UnauthorizedError('Credenciales invalidas');
  }

  if (u.BloqueadoHasta && new Date(u.BloqueadoHasta) > new Date()) {
    throw new UnauthorizedError('Cuenta bloqueada temporalmente; intente mas tarde');
  }

  if (!u.Activo) {
    throw new UnauthorizedError('Usuario desactivado');
  }

  const ok = await bcrypt.compare(contrasena, u.HashContrasena);
  if (!ok) {
    await executeSp('SP_Auth_RegistrarIntentoFallido', [
      { name: 'IDUsuario', type: sql.Int, value: u.IDUsuario },
    ]);
    throw new UnauthorizedError('Credenciales invalidas');
  }

  await executeSp('SP_Auth_RegistrarLoginExitoso', [
    { name: 'IDUsuario', type: sql.Int, value: u.IDUsuario },
  ]);

  const sesion = await emitirParGuardando(u, ip);
  const carritoFusionado = await fusionarCarritoInvitado(u.IDUsuario, tokenInvitado);
  return { ...sesion, carritoFusionado };
}

export async function refresh(refreshToken: string, ip: string | null): Promise<SesionResponse> {
  const tokenHash = sha256Hex(refreshToken);
  const nuevoRefresh = randomBytes(32).toString('hex');
  const nuevoHash = sha256Hex(nuevoRefresh);
  const fechaExpira = new Date(Date.now() + duracionAMs(env.JWT_REFRESH_EXPIRES));

  const result = await executeSp<UsuarioTokenData>('SP_Auth_RotarRefreshToken', [
    { name: 'TokenHash', type: sql.Char(64), value: tokenHash },
    { name: 'NuevoTokenHash', type: sql.Char(64), value: nuevoHash },
    { name: 'FechaExpiraNuevo', type: sql.DateTime2(0), value: fechaExpira },
    { name: 'DireccionIP', type: sql.NVarChar(45), value: ip },
  ]);

  // El SP ya persistio el nuevo token; aqui solo se emite el access.
  const u = result.recordset[0];
  return respuestaSesion(u, emitirAccessToken(u), nuevoRefresh);
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = sha256Hex(refreshToken);
  await executeSp('SP_Auth_RevocarRefreshToken', [
    { name: 'TokenHash', type: sql.Char(64), value: tokenHash },
  ]);
}

export async function yo(idUsuario: number): Promise<unknown> {
  const result = await executeSp('SP_Auth_ObtenerUsuarioPorID', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return result.recordset[0];
}
