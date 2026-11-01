import sql from 'mssql';
import ExcelJS from 'exceljs';
import { executeSp } from '../data/spExecutor.js';
import { conCache } from '../utils/reportesCache.js';
import type { VentasQuery, TopProductosQuery, CarritosQuery, RangoQuery } from '../schemas/reportes.schema.js';

/* ------------------------------ Reportes JSON ----------------------------- */

export interface Reporte<T> {
  data: T;
  cacheHit: boolean;
}

export function resumen(q: RangoQuery): Promise<Reporte<unknown>> {
  return conCache('resumen', { desde: q.desde, hasta: q.hasta }, async () => {
    const result = await executeSp('SP_Reportes_Resumen', [
      { name: 'Desde', type: sql.DateTime2(0), value: q.desde },
      { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta },
    ]);
    return (result.recordset[0] ?? null) as unknown;
  });
}

export function ventas(q: VentasQuery): Promise<Reporte<unknown[]>> {
  return conCache('ventas', { desde: q.desde, hasta: q.hasta, agrupacion: q.agrupacion }, async () => {
    const result = await executeSp('SP_Reportes_VentasPorPeriodo', [
      { name: 'Desde', type: sql.DateTime2(0), value: q.desde },
      { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta },
      { name: 'Agrupacion', type: sql.NVarChar(10), value: q.agrupacion },
    ]);
    return (result.recordset ?? []) as unknown[];
  });
}

export function categorias(q: RangoQuery): Promise<Reporte<unknown[]>> {
  return conCache('categorias', { desde: q.desde, hasta: q.hasta }, async () => {
    const result = await executeSp('SP_Reportes_VentasPorCategoria', [
      { name: 'Desde', type: sql.DateTime2(0), value: q.desde },
      { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta },
    ]);
    return (result.recordset ?? []) as unknown[];
  });
}

export function topProductos(q: TopProductosQuery): Promise<Reporte<unknown[]>> {
  return conCache('top-productos', { desde: q.desde, hasta: q.hasta, top: q.top }, async () => {
    const result = await executeSp('SP_Reportes_TopProductos', [
      { name: 'Desde', type: sql.DateTime2(0), value: q.desde },
      { name: 'Hasta', type: sql.DateTime2(0), value: q.hasta },
      { name: 'Top', type: sql.Int, value: q.top },
    ]);
    return (result.recordset ?? []) as unknown[];
  });
}

export function carritosAbandonados(q: CarritosQuery): Promise<
  Reporte<{ filas: unknown[]; total: number; pagina: number; tamanoPagina: number }>
> {
  return conCache('carritos-abandonados', { pagina: q.pagina, tamanoPagina: q.tamanoPagina }, async () => {
    const result = await executeSp('SP_Reportes_CarritosAbandonados', [
      { name: 'Pagina', type: sql.Int, value: q.pagina },
      { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
    ]);
    const filas = (result.recordsets[0] ?? []) as unknown[];
    const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
    return { filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
  });
}

/* ------------------------------ Export a Excel ---------------------------- */

type TipoColumna = 'texto' | 'dinero' | 'fecha' | 'numero';
interface ColumnaExcel {
  header: string;
  key: string;
  width: number;
  tipo: TipoColumna;
}

export interface ResultadoExport {
  buffer: Buffer;
  filename: string;
  filas: number;
  cacheHit: boolean;
}

/**
 * Evita inyeccion de formulas: un texto que empieza por = + - @ (o por tab, retorno
 * de carro o barra vertical, que algunos lectores tratan como separador de comando)
 * se antepone con un apostrofo. La celda ademas se fuerza a tipo texto (numFmt '@').
 */
function textoSeguro(valor: unknown): string {
  const s = valor === null || valor === undefined ? '' : String(valor);
  return /^[=+\-@\t\r|]/.test(s) ? `'${s}` : s;
}

function yyyymmdd(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).replace(/-/g, '');
}

async function construirExcel(opts: {
  hoja: string;
  titulo: string;
  subtitulo: string;
  columnas: ColumnaExcel[];
  filas: Array<Record<string, unknown>>;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(opts.hoja);

  const tituloCell = ws.getCell('A1');
  tituloCell.value = opts.titulo;
  tituloCell.font = { bold: true, size: 14 };

  const subCell = ws.getCell('A2');
  subCell.value = opts.subtitulo;
  subCell.font = { italic: true };

  const filaEncabezado = 4;
  opts.columnas.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
    const cell = ws.getRow(filaEncabezado).getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true };
  });

  opts.filas.forEach((fila, r) => {
    const row = ws.getRow(filaEncabezado + 1 + r);
    opts.columnas.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const v = fila[col.key];
      if (col.tipo === 'dinero') {
        cell.value = typeof v === 'number' ? v : Number(v ?? 0);
        cell.numFmt = '"Q" #,##0.00';
      } else if (col.tipo === 'fecha') {
        cell.value = v ? new Date(v as string) : null;
        cell.numFmt = 'yyyy-mm-dd';
      } else if (col.tipo === 'numero') {
        cell.value = typeof v === 'number' ? v : v == null ? null : Number(v);
      } else {
        cell.value = textoSeguro(v);
        cell.numFmt = '@';
      }
    });
  });

  ws.autoFilter = {
    from: { row: filaEncabezado, column: 1 },
    to: { row: filaEncabezado, column: opts.columnas.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

function subtituloRango(desde: Date, hasta: Date): string {
  return `Periodo: ${desde.toISOString().slice(0, 10)} a ${hasta.toISOString().slice(0, 10)}`;
}

export async function exportVentas(q: VentasQuery): Promise<ResultadoExport> {
  const { data, cacheHit } = await ventas(q);
  const filas = data as Array<Record<string, unknown>>;
  const buffer = await construirExcel({
    hoja: 'Ventas',
    titulo: `Ventas por periodo (${q.agrupacion})`,
    subtitulo: subtituloRango(q.desde, q.hasta),
    columnas: [
      { header: 'Periodo', key: 'Periodo', width: 14, tipo: 'fecha' },
      { header: 'Pedidos', key: 'Pedidos', width: 10, tipo: 'numero' },
      { header: 'Venta bruta', key: 'VentaBruta', width: 16, tipo: 'dinero' },
      { header: 'Devoluciones', key: 'Devoluciones', width: 16, tipo: 'dinero' },
      { header: 'Venta neta', key: 'VentaNeta', width: 16, tipo: 'dinero' },
      { header: 'Ticket promedio', key: 'TicketPromedio', width: 16, tipo: 'dinero' },
    ],
    filas,
  });
  return { buffer, filename: `ventas_${yyyymmdd(q.desde)}_${yyyymmdd(q.hasta)}.xlsx`, filas: filas.length, cacheHit };
}

export async function exportCategorias(q: RangoQuery): Promise<ResultadoExport> {
  const { data, cacheHit } = await categorias(q);
  const filas = data as Array<Record<string, unknown>>;
  const buffer = await construirExcel({
    hoja: 'Categorias',
    titulo: 'Ventas por categoria',
    subtitulo: subtituloRango(q.desde, q.hasta),
    columnas: [
      { header: 'Categoria', key: 'Categoria', width: 30, tipo: 'texto' },
      { header: 'Pedidos', key: 'Pedidos', width: 10, tipo: 'numero' },
      { header: 'Unidades netas', key: 'UnidadesNetas', width: 16, tipo: 'numero' },
      { header: 'Monto neto', key: 'MontoNeto', width: 16, tipo: 'dinero' },
    ],
    filas,
  });
  return { buffer, filename: `categorias_${yyyymmdd(q.desde)}_${yyyymmdd(q.hasta)}.xlsx`, filas: filas.length, cacheHit };
}

export async function exportTopProductos(q: TopProductosQuery): Promise<ResultadoExport> {
  const { data, cacheHit } = await topProductos(q);
  const filas = data as Array<Record<string, unknown>>;
  const buffer = await construirExcel({
    hoja: 'Top productos',
    titulo: `Top ${q.top} productos`,
    subtitulo: subtituloRango(q.desde, q.hasta),
    columnas: [
      { header: 'Producto', key: 'Producto', width: 34, tipo: 'texto' },
      { header: 'Categoria', key: 'Categoria', width: 24, tipo: 'texto' },
      { header: 'Unidades netas', key: 'UnidadesNetas', width: 16, tipo: 'numero' },
      { header: 'Monto neto', key: 'MontoNeto', width: 16, tipo: 'dinero' },
    ],
    filas,
  });
  return {
    buffer,
    filename: `top-productos_${yyyymmdd(q.desde)}_${yyyymmdd(q.hasta)}.xlsx`,
    filas: filas.length,
    cacheHit,
  };
}
