import sql from 'mssql';
import { executeSp, type SpParam } from '../data/spExecutor.js';
import { conCache } from '../utils/reportesCache.js';
import type { Reporte } from './reportes.service.js';
import type { RangoQuery } from '../schemas/reportes.schema.js';
import type { DashboardCuponesQuery, DashboardHorasQuery } from '../schemas/dashboard.schema.js';

/**
 * Datos del dashboard del area interna (F9). Cada lectura pasa por el MISMO cache de
 * reportes de M9 (conCache -> X-Cache HIT/MISS), que se invalida por los eventos del
 * bus. Ninguna cifra se calcula aqui: los SPs de 028 devuelven todo ya resuelto.
 */

function rango(q: RangoQuery): SpParam[] {
  return [
    { name: 'Desde', type: sql.DateTime2(0), value: q.desde },
    { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta },
  ];
}

export function resumen(q: RangoQuery): Promise<Reporte<unknown>> {
  return conCache('dashboard-resumen', { desde: q.desde, hasta: q.hasta }, async () => {
    const result = await executeSp('SP_Dashboard_Resumen', rango(q));
    return (result.recordset[0] ?? null) as unknown;
  });
}

export function ventasPorDia(q: RangoQuery): Promise<Reporte<unknown[]>> {
  return conCache('dashboard-ventas-dia', { desde: q.desde, hasta: q.hasta }, async () => {
    const result = await executeSp('SP_Dashboard_VentasPorDia', rango(q));
    return (result.recordset ?? []) as unknown[];
  });
}

export function categorias(q: RangoQuery): Promise<Reporte<unknown[]>> {
  return conCache('dashboard-categorias', { desde: q.desde, hasta: q.hasta }, async () => {
    const result = await executeSp('SP_Dashboard_VentasPorCategoria', rango(q));
    return (result.recordset ?? []) as unknown[];
  });
}

export function embudo(q: RangoQuery): Promise<Reporte<unknown>> {
  return conCache('dashboard-embudo', { desde: q.desde, hasta: q.hasta }, async () => {
    const result = await executeSp('SP_Dashboard_Embudo', rango(q));
    return (result.recordset[0] ?? null) as unknown;
  });
}

export function horasPico(q: DashboardHorasQuery): Promise<Reporte<unknown[]>> {
  // La zona entra en la clave de cache; si no viene, el SP usa Guatemala por defecto.
  return conCache('dashboard-horas', { desde: q.desde, hasta: q.hasta, zona: q.zona ?? null }, async () => {
    const params = rango(q);
    if (q.zona) params.push({ name: 'ZonaHoraria', type: sql.NVarChar(64), value: q.zona });
    const result = await executeSp('SP_Dashboard_HorasPico', params);
    return (result.recordset ?? []) as unknown[];
  });
}

export function cupones(q: DashboardCuponesQuery): Promise<Reporte<unknown[]>> {
  return conCache('dashboard-cupones', { desde: q.desde, hasta: q.hasta, top: q.top }, async () => {
    const result = await executeSp('SP_Dashboard_Cupones', [...rango(q), { name: 'Top', type: sql.Int, value: q.top }]);
    return (result.recordset ?? []) as unknown[];
  });
}
