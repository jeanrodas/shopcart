import type { RequestHandler } from 'express';
import * as dashboardService from '../services/dashboard.service.js';
import type { RangoQuery, TopProductosQuery } from '../schemas/reportes.schema.js';
import type { DashboardCuponesQuery, DashboardHorasQuery, DashboardVentasQuery } from '../schemas/dashboard.schema.js';

/** Responde JSON y marca X-Cache segun el acierto de cache (igual que M9). */
function responder(
  res: Parameters<RequestHandler>[1],
  resultado: { data: unknown; cacheHit: boolean },
): void {
  res.setHeader('X-Cache', resultado.cacheHit ? 'HIT' : 'MISS');
  res.status(200).json(resultado.data);
}

export const getResumen: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.resumen(req.query as unknown as RangoQuery));
};

export const getVentasPorDia: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.ventasPorDia(req.query as unknown as DashboardVentasQuery));
};

export const getCategorias: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.categorias(req.query as unknown as RangoQuery));
};

export const getEmbudo: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.embudo(req.query as unknown as RangoQuery));
};

export const getHorasPico: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.horasPico(req.query as unknown as DashboardHorasQuery));
};

export const getCupones: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.cupones(req.query as unknown as DashboardCuponesQuery));
};

// Top productos del dashboard: SP envoltorio de 028 (ranking de M9 + ImagenPrincipal),
// expuesto tambien al Operador.
export const getTopProductos: RequestHandler = async (req, res) => {
  responder(res, await dashboardService.topProductos(req.query as unknown as TopProductosQuery));
};
