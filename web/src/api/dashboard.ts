import { peticion, peticionBlob } from './clienteHttp';
import type {
  CategoriaVenta,
  CeldaHoraPico,
  CuponDashboard,
  DashboardRespuesta,
  EmbudoDashboard,
  Granularidad,
  PuntoVentaDia,
  RangoDashboard,
  ResumenDashboard,
  TopProductoDashboard,
} from './tipos';

/** GET de un bloque del dashboard que ademas reporta si la respuesta vino del cache. */
async function conCache<T>(ruta: string): Promise<DashboardRespuesta<T>> {
  let cache = false;
  const datos = await peticion<T>(ruta, {
    alResponder: (h) => {
      cache = h.get('X-Cache') === 'HIT';
    },
  });
  return { datos, cache };
}

function rango(r: RangoDashboard): string {
  const qs = new URLSearchParams({ desde: r.desde, hasta: r.hasta });
  return qs.toString();
}

export function obtenerResumenDashboard(r: RangoDashboard) {
  return conCache<ResumenDashboard>(`/api/v1/dashboard/resumen?${rango(r)}`);
}

export function obtenerVentasPorDia(r: RangoDashboard, granularidad: Granularidad = 'DIA') {
  return conCache<PuntoVentaDia[]>(`/api/v1/dashboard/ventas-dia?${rango(r)}&granularidad=${granularidad}`);
}

export function obtenerVentasPorCategoria(r: RangoDashboard) {
  return conCache<CategoriaVenta[]>(`/api/v1/dashboard/categorias?${rango(r)}`);
}

export function obtenerEmbudo(r: RangoDashboard) {
  return conCache<EmbudoDashboard>(`/api/v1/dashboard/embudo?${rango(r)}`);
}

export function obtenerHorasPico(r: RangoDashboard) {
  return conCache<CeldaHoraPico[]>(`/api/v1/dashboard/horas-pico?${rango(r)}`);
}

export function obtenerTopProductosDashboard(r: RangoDashboard, top = 8) {
  return conCache<TopProductoDashboard[]>(`/api/v1/dashboard/top-productos?${rango(r)}&top=${top}`);
}

export function obtenerCuponesDashboard(r: RangoDashboard, top = 8) {
  return conCache<CuponDashboard[]>(`/api/v1/dashboard/cupones?${rango(r)}&top=${top}`);
}

/** Pide un ticket de un solo uso para abrir el stream SSE (GET /eventos?ticket=...). */
export function obtenerTicketEventos(): Promise<{ ticket: string }> {
  return peticion<{ ticket: string }>('/api/v1/eventos/ticket', { method: 'POST' });
}

/**
 * Descarga un .xlsx de los reportes de M9 (solo Administrador). Pasa por `peticionBlob`
 * (cliente HTTP), asi el token va en la cabecera y hereda la renovacion transparente del
 * access tras un TOKEN_EXPIRED (igual que cualquier otra peticion).
 */
export async function descargarExcelReporte(ruta: string): Promise<void> {
  const { blob, headers } = await peticionBlob(ruta);
  const cd = headers.get('Content-Disposition') ?? '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  const nombre = m?.[1] ?? 'reporte.xlsx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
