import type { RespuestaSesion } from './tipos';

/**
 * Cliente HTTP de ShopCart. Centraliza:
 *   - el access token EN MEMORIA (nunca en almacenamiento) y el refresh en localStorage;
 *   - el X-Cart-Token del carrito de invitado (localStorage), enviado en /carrito y login;
 *   - el parseo del formato de error del errorHandler de la API -> ErrorApi tipado;
 *   - la renovacion del access (single-flight) ante un 401 TOKEN_EXPIRED, con un reintento.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const CLAVE_REFRESH = 'shopcart.refreshToken';
const CLAVE_CART = 'shopcart.cartToken';

/* ------------------------------- Tokens ---------------------------------- */

let accessToken: string | null = null;

export function fijarAccessToken(token: string | null): void {
  accessToken = token;
}

export function obtenerAccessToken(): string | null {
  return accessToken;
}

function lsLeer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function lsEscribir(clave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* almacenamiento no disponible (p. ej. ventana privada): se ignora */
  }
}

export function obtenerRefreshToken(): string | null {
  return lsLeer(CLAVE_REFRESH);
}
export function fijarRefreshToken(token: string | null): void {
  lsEscribir(CLAVE_REFRESH, token);
}
export function obtenerCartToken(): string | null {
  return lsLeer(CLAVE_CART);
}
export function fijarCartToken(token: string | null): void {
  lsEscribir(CLAVE_CART, token);
}

/* ------------------------------- Errores --------------------------------- */

export interface DatosErrorApi {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

export class ErrorApi extends Error implements DatosErrorApi {
  readonly status: number;
  readonly codigo: string;
  readonly mensaje: string;
  readonly detalles?: unknown;

  constructor(datos: DatosErrorApi) {
    super(datos.mensaje);
    this.name = 'ErrorApi';
    this.status = datos.status;
    this.codigo = datos.codigo;
    this.mensaje = datos.mensaje;
    this.detalles = datos.detalles;
  }
}

async function construirError(res: Response): Promise<ErrorApi> {
  let cuerpo: { code?: string; message?: string; details?: unknown } = {};
  try {
    cuerpo = (await res.json()) as typeof cuerpo;
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  return new ErrorApi({
    status: res.status,
    codigo: cuerpo.code ?? `HTTP_${res.status}`,
    mensaje: cuerpo.message ?? 'No se pudo completar la solicitud',
    detalles: cuerpo.details,
  });
}

/* --------------------------- Sesion expirada ----------------------------- */

let alExpirarSesion: (() => void) | null = null;

/** AuthContext registra aqui como cerrar sesion y redirigir cuando el refresh falla. */
export function registrarAlExpirarSesion(cb: (() => void) | null): void {
  alExpirarSesion = cb;
}

export function cerrarSesionLocal(): void {
  accessToken = null;
  fijarRefreshToken(null);
}

/* ------------------------------ Peticiones ------------------------------- */

interface OpcionesPeticion {
  method?: string;
  body?: unknown;
  /** Fuerza (o evita) enviar X-Cart-Token; por defecto se deduce de la ruta. */
  cart?: boolean;
  /** No intentar renovar el access ante un 401 (para login/refresh). */
  sinRefresh?: boolean;
  headers?: Record<string, string>;
}

function rutaUsaCarrito(ruta: string): boolean {
  return ruta.includes('/carrito') || ruta.endsWith('/auth/login') || ruta.endsWith('/auth/registro');
}

async function ejecutar(ruta: string, opc: OpcionesPeticion): Promise<Response> {
  const headers: Record<string, string> = { ...opc.headers };
  if (opc.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (opc.cart ?? rutaUsaCarrito(ruta)) {
    const ct = obtenerCartToken();
    if (ct) headers['X-Cart-Token'] = ct;
  }

  const res = await fetch(`${BASE}${ruta}`, {
    method: opc.method ?? 'GET',
    headers,
    body: opc.body !== undefined ? JSON.stringify(opc.body) : undefined,
  });

  const ctRespuesta = res.headers.get('X-Cart-Token');
  if (ctRespuesta) fijarCartToken(ctRespuesta);
  return res;
}

let refrescando: Promise<RespuestaSesion> | null = null;

/** Renueva el access con el refresh guardado. Actualiza ambos tokens. */
export async function refrescarSesion(): Promise<RespuestaSesion> {
  const rt = obtenerRefreshToken();
  if (!rt) {
    throw new ErrorApi({ status: 401, codigo: 'UNAUTHORIZED', mensaje: 'No hay sesion activa' });
  }
  const res = await ejecutar('/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken: rt },
    sinRefresh: true,
  });
  if (!res.ok) throw await construirError(res);
  const data = (await res.json()) as RespuestaSesion;
  accessToken = data.accessToken;
  fijarRefreshToken(data.refreshToken);
  return data;
}

/** Garantiza UNA sola llamada a /auth/refresh aunque varias peticiones fallen a la vez. */
function refrescarUnaVez(): Promise<RespuestaSesion> {
  if (!refrescando) {
    refrescando = refrescarSesion().finally(() => {
      refrescando = null;
    });
  }
  return refrescando;
}

export async function peticion<T>(ruta: string, opc: OpcionesPeticion = {}): Promise<T> {
  let res = await ejecutar(ruta, opc);

  if (res.status === 401 && !opc.sinRefresh && obtenerRefreshToken()) {
    let codigo: string | undefined;
    try {
      codigo = ((await res.clone().json()) as { code?: string }).code;
    } catch {
      /* sin cuerpo */
    }
    if (codigo === 'TOKEN_EXPIRED') {
      try {
        await refrescarUnaVez();
      } catch {
        cerrarSesionLocal();
        alExpirarSesion?.();
        throw new ErrorApi({ status: 401, codigo: 'SESION_EXPIRADA', mensaje: 'Tu sesión expiró' });
      }
      res = await ejecutar(ruta, opc); // reintento unico
    }
  }

  if (!res.ok) throw await construirError(res);
  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  return (texto ? (JSON.parse(texto) as T) : (undefined as T));
}
