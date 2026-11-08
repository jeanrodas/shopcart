import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UnauthorizedError } from '../errors/index.js';

const BCRYPT_COST = 10;

/** Enmascara el correo para los logs: conserva 2 chars del local y el dominio. */
function correoTruncado(correo: string): string {
  const [local, dominio] = correo.split('@');
  const visibles = (local ?? '').slice(0, 2);
  return dominio ? `${visibles}***@${dominio}` : `${visibles}***`;
}

/*
 * Lockout en memoria por (correo + IP), complementario al contador por cuenta en BD
 * (Usuario.IntentosFallidos, umbral LOGIN_MAX_INTENTOS). Esta capa frena el ataque de
 * fuerza bruta desde una IP SIN permitir que un atacante bloquee la cuenta ajena: el
 * bloqueo es por par (correo, IP), no por cuenta. Tras MAX_INTENTOS_IP fallos en
 * VENTANA_MS desde la misma IP para el mismo correo, se rechaza sin tocar la BD. Es
 * por-proceso (con varias instancias de API, iria a un store compartido tipo Redis).
 */
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS_IP = 5;
const intentosIpCorreo = new Map<string, { conteo: number; expira: number }>();

function claveIntentos(correo: string, ip: string | null): string {
  return `${correo.toLowerCase()}|${ip ?? 'sin-ip'}`;
}

function intentosBloqueado(correo: string, ip: string | null): boolean {
  const clave = claveIntentos(correo, ip);
  const e = intentosIpCorreo.get(clave);
  if (!e) return false;
  if (Date.now() > e.expira) {
    intentosIpCorreo.delete(clave);
    return false;
  }
  return e.conteo >= MAX_INTENTOS_IP;
}

function intentosRegistrarFallo(correo: string, ip: string | null): void {
  const clave = claveIntentos(correo, ip);
  const ahora = Date.now();
  const e = intentosIpCorreo.get(clave);
  if (!e || ahora > e.expira) {
    intentosIpCorreo.set(clave, { conteo: 1, expira: ahora + VENTANA_MS });
  } else {
    e.conteo += 1;
  }
}

function intentosLimpiar(correo: string, ip: string | null): void {
  intentosIpCorreo.delete(claveIntentos(correo, ip));
}

// Hash dummy de costo equivalente: se compara contra el cuando el correo no
// existe, para que el tiempo de respuesta no revele si el usuario existe.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-shopcart', BCRYPT_COST);

interface UsuarioTokenData {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  IDRol: number;
  Rol: string;
  /** 1 si debe cambiar la contrasena temporal en el primer acceso (solo lo trae el login). */
  DebeCambiarContrasena?: boolean;
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
  usuario: { id: number; correo: string; nombre: string; rol: string; debeCambiarContrasena: boolean };
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
    algorithm: 'HS256',
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
    usuario: {
      id: u.IDUsuario,
      correo: u.Correo,
      nombre: u.Nombre,
      rol: u.Rol,
      debeCambiarContrasena: Boolean(u.DebeCambiarContrasena),
    },
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
  requestId: string | null = null,
): Promise<SesionResponse & { carritoFusionado: CarritoFusionado | null }> {
  // Capa 1 (memoria, por correo+IP): si ya se supero el umbral, se rechaza SIN
  // consultar la BD. No bloquea la cuenta para otras IPs.
  if (intentosBloqueado(correo, ip)) {
    logger.warn(
      { requestId, correo: correoTruncado(correo), causa: 'bloqueo temporal por IP+cuenta' },
      'login fallido',
    );
    throw new UnauthorizedError('Credenciales invalidas');
  }

  const result = await executeSp<UsuarioLogin>('SP_Auth_ObtenerUsuarioPorCorreo', [
    { name: 'Correo', type: sql.NVarChar(255), value: correo },
  ]);
  const u = result.recordset[0];

  // Respuesta UNIFORME para el cliente: cualquier causa (usuario inexistente,
  // contrasena incorrecta, cuenta bloqueada o desactivada) responde 401
  // 'Credenciales invalidas'. La causa real solo va al log (correo enmascarado,
  // nunca la contrasena), para no filtrar que cuentas existen o estan bloqueadas.
  // Cada fallo suma en la capa 1 (memoria, por correo+IP).
  const fallar = (causa: string): never => {
    intentosRegistrarFallo(correo, ip);
    logger.warn({ requestId, correo: correoTruncado(correo), causa }, 'login fallido');
    throw new UnauthorizedError('Credenciales invalidas');
  };

  if (!u) {
    // Comparacion dummy para igualar tiempos; no revela si el correo existe.
    await bcrypt.compare(contrasena, DUMMY_HASH);
    return fallar('usuario inexistente');
  }

  // La comparacion se hace siempre (antes de los chequeos de estado) para que el
  // tiempo de respuesta no distinga una cuenta bloqueada/desactivada de una activa.
  const ok = await bcrypt.compare(contrasena, u.HashContrasena);

  if (u.BloqueadoHasta && new Date(u.BloqueadoHasta) > new Date()) {
    return fallar('cuenta bloqueada');
  }
  if (!u.Activo) {
    return fallar('usuario desactivado');
  }
  if (!ok) {
    await executeSp('SP_Auth_RegistrarIntentoFallido', [
      { name: 'IDUsuario', type: sql.Int, value: u.IDUsuario },
    ]);
    return fallar('contrasena incorrecta');
  }

  // Exito: limpia ambas capas (BD la resetea el SP; memoria aqui).
  await executeSp('SP_Auth_RegistrarLoginExitoso', [
    { name: 'IDUsuario', type: sql.Int, value: u.IDUsuario },
  ]);
  intentosLimpiar(correo, ip);

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

/**
 * Cambia la contrasena del usuario autenticado: compara la actual con bcrypt (igual
 * que el login), guarda el hash nuevo y revoca toda la cadena de refresh del usuario.
 * El par (correo inexistente) no aplica: el usuario ya esta autenticado por su access.
 */
export async function cambiarContrasena(
  idUsuario: number,
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  const actual = await executeSp<{ HashContrasena: string; Activo: boolean }>(
    'SP_Auth_ObtenerHashPorID',
    [{ name: 'IDUsuario', type: sql.Int, value: idUsuario }],
  );
  const fila = actual.recordset[0];
  if (!fila || !fila.Activo) {
    throw new UnauthorizedError();
  }
  const ok = await bcrypt.compare(contrasenaActual, fila.HashContrasena);
  if (!ok) {
    throw new UnauthorizedError('La contrasena actual no es correcta');
  }

  const hashNuevo = await bcrypt.hash(contrasenaNueva, BCRYPT_COST);
  await executeSp('SP_Auth_CambiarContrasena', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'HashNuevo', type: sql.NVarChar(255), value: hashNuevo },
  ]);
}

export async function yo(idUsuario: number): Promise<unknown> {
  const result = await executeSp('SP_Auth_ObtenerUsuarioPorID', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return result.recordset[0];
}
