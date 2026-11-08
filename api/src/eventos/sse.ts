import { randomBytes } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { suscribir, numSuscriptores, type EventoSSE } from './bus.js';
import * as pedidosService from '../services/pedidos.service.js';
import * as inventarioService from '../services/inventario.service.js';
import { executeSp } from '../data/spExecutor.js';
import { logger } from '../config/logger.js';

/**
 * Transporte SSE del area interna. La autenticacion NO usa el JWT en la URL (un
 * EventSource no puede mandar cabecera Authorization, y un token en el query quedaria
 * en logs/historial/proxies): en su lugar POST /eventos/ticket (autenticado) entrega un
 * ticket aleatorio de un solo uso que caduca en 60 s, y GET /eventos?ticket=... lo
 * consume para abrir el stream.
 */

const TICKET_TTL_MS = 60_000;
const PING_MS = 25_000;
const MAX_CONEXIONES = 5; // por usuario; la 6.a cierra la mas antigua
const RETRY_MS = 5000;

interface Ticket {
  idUsuario: number;
  rol: string;
  expira: number;
}

const tickets = new Map<string, Ticket>();

function barrerVencidos(): void {
  const ahora = Date.now();
  for (const [clave, t] of tickets) if (ahora > t.expira) tickets.delete(clave);
}

/** Emite un ticket de un solo uso (60 s) para abrir el stream SSE. */
export function emitirTicket(idUsuario: number, rol: string): string {
  barrerVencidos();
  const ticket = randomBytes(32).toString('hex');
  tickets.set(ticket, { idUsuario, rol, expira: Date.now() + TICKET_TTL_MS });
  return ticket;
}

/** Consume (borra) y valida un ticket. Devuelve null si no existe, ya se uso o vencio. */
function consumirTicket(ticket: string | undefined): Ticket | null {
  if (!ticket) return null;
  const t = tickets.get(ticket);
  if (!t) return null;
  tickets.delete(ticket); // un solo uso: reusarlo falla
  if (Date.now() > t.expira) return null;
  return t;
}

// Conexiones abiertas por usuario (para el tope de 5).
const conexiones = new Map<number, Response[]>();

function registrar(idUsuario: number, res: Response): void {
  const lista = conexiones.get(idUsuario) ?? [];
  lista.push(res);
  conexiones.set(idUsuario, lista);
  while (lista.length > MAX_CONEXIONES) {
    const viejo = lista.shift();
    viejo?.end(); // su propio 'close' limpia el resto
  }
}

function quitar(idUsuario: number, res: Response): void {
  const lista = conexiones.get(idUsuario);
  if (!lista) return;
  const i = lista.indexOf(res);
  if (i >= 0) lista.splice(i, 1);
  if (lista.length === 0) conexiones.delete(idUsuario);
}

/** Total de conexiones SSE abiertas (todos los usuarios). Para pruebas/diagnostico. */
export function numConexiones(): number {
  let n = 0;
  for (const lista of conexiones.values()) n += lista.length;
  return n;
}

/** GET /eventos?ticket=... : valida y consume el ticket, abre el text/event-stream. */
export const abrirFlujo: RequestHandler = async (req, res) => {
  const t = consumirTicket(req.query.ticket as string | undefined);
  if (!t) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Ticket de eventos invalido o vencido',
      requestId: req.requestId ?? 'desconocido',
    });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx: no bufferiza el stream
  res.flushHeaders?.();

  registrar(t.idUsuario, res);

  let id = 0;
  const enviar = (tipo: string, datos: unknown): void => {
    id += 1;
    res.write(`id: ${id}\n`);
    res.write(`retry: ${RETRY_MS}\n`);
    res.write(`event: ${tipo}\n`);
    res.write(`data: ${JSON.stringify(datos)}\n\n`);
  };

  // Holder mutable para los recursos del stream (evita referencias circulares entre
  // cerrar() y los listeners que lo invocan).
  const estado: { cerrado: boolean; ping?: ReturnType<typeof setInterval>; desuscribir?: () => void } = {
    cerrado: false,
  };
  const cerrar = (): void => {
    if (estado.cerrado) return;
    estado.cerrado = true;
    if (estado.ping) clearInterval(estado.ping);
    estado.desuscribir?.();
    quitar(t.idUsuario, res);
    res.end();
  };

  // Se registra ANTES del await inicial: si el cliente aborta durante ese await, 'close'
  // dispara cerrar() igual (y no quedan listener ni interval, porque aun no se crearon).
  req.on('close', cerrar);

  // Estado inicial ("hola"): contadores de operacion e inventario para pintar el
  // panel "Ahora mismo" sin una llamada extra. Un fallo de BD no tumba el stream.
  let inicial: { instalacion: string | null; operacion: unknown; inventario: unknown };
  try {
    const [operacion, inventario, inst] = await Promise.all([
      pedidosService.resumenOperacion(),
      inventarioService.resumenInventario(),
      executeSp<{ Instalacion: string }>('SP_Sistema_Instalacion', []),
    ]);
    inicial = { instalacion: inst.recordset[0]?.Instalacion ?? null, operacion, inventario: inventario.resumen };
  } catch (err) {
    logger.warn({ err }, 'SSE: no se pudo construir el estado inicial');
    inicial = { instalacion: null, operacion: null, inventario: null };
  }

  // Si el cliente se desconecto durante el await, no se suscribe al bus ni se crea el
  // interval (evita listeners/intervals huerfanos). cerrar() es idempotente.
  if (estado.cerrado || req.destroyed) {
    cerrar();
    return;
  }
  enviar('hola', inicial);

  estado.desuscribir = suscribir((e: EventoSSE) => {
    // Datos de cupones solo para Administrador: el Operador no recibe cupon.usado.
    if (e.tipo === 'cupon.usado' && t.rol !== 'Administrador') return;
    try {
      enviar(e.tipo, e.datos);
    } catch {
      cerrar();
    }
  });

  estado.ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      cerrar();
    }
  }, PING_MS);
};

/** Diagnostico (solo pruebas): conexiones SSE abiertas y suscriptores del bus. */
export const diagnosticoSSE: RequestHandler = (_req, res) => {
  res.status(200).json({ conexiones: numConexiones(), suscriptores: numSuscriptores() });
};
