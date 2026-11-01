import type { RequestHandler } from 'express';
import * as reportesService from '../services/reportes.service.js';
import { logger } from '../config/logger.js';
import type {
  RangoQuery,
  VentasQuery,
  TopProductosQuery,
  CarritosQuery,
} from '../schemas/reportes.schema.js';
import type { ResultadoExport } from '../services/reportes.service.js';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Responde un reporte JSON y marca X-Cache segun el acierto de cache. */
function responderJson(
  res: Parameters<RequestHandler>[1],
  resultado: { data: unknown; cacheHit: boolean },
): void {
  res.setHeader('X-Cache', resultado.cacheHit ? 'HIT' : 'MISS');
  res.status(200).json(resultado.data);
}

/** Responde un .xlsx como descarga, marca X-Cache y registra una linea de log. */
function responderExcel(
  res: Parameters<RequestHandler>[1],
  reporte: string,
  resultado: ResultadoExport,
): void {
  logger.info({ reporte, filas: resultado.filas, cache: resultado.cacheHit ? 'HIT' : 'MISS' }, 'export de reporte');
  res.setHeader('X-Cache', resultado.cacheHit ? 'HIT' : 'MISS');
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${resultado.filename}"`);
  res.status(200).send(resultado.buffer);
}

/* --------------------------------- JSON ----------------------------------- */

export const getResumen: RequestHandler = async (req, res) => {
  responderJson(res, await reportesService.resumen(req.query as unknown as RangoQuery));
};

export const getVentas: RequestHandler = async (req, res) => {
  responderJson(res, await reportesService.ventas(req.query as unknown as VentasQuery));
};

export const getCategorias: RequestHandler = async (req, res) => {
  responderJson(res, await reportesService.categorias(req.query as unknown as RangoQuery));
};

export const getTopProductos: RequestHandler = async (req, res) => {
  responderJson(res, await reportesService.topProductos(req.query as unknown as TopProductosQuery));
};

export const getCarritosAbandonados: RequestHandler = async (req, res) => {
  responderJson(res, await reportesService.carritosAbandonados(req.query as unknown as CarritosQuery));
};

/* -------------------------------- Export ---------------------------------- */

export const getVentasExport: RequestHandler = async (req, res) => {
  responderExcel(res, 'ventas', await reportesService.exportVentas(req.query as unknown as VentasQuery));
};

export const getCategoriasExport: RequestHandler = async (req, res) => {
  responderExcel(res, 'categorias', await reportesService.exportCategorias(req.query as unknown as RangoQuery));
};

export const getTopProductosExport: RequestHandler = async (req, res) => {
  responderExcel(
    res,
    'top-productos',
    await reportesService.exportTopProductos(req.query as unknown as TopProductosQuery),
  );
};
