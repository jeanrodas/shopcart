import { peticion } from './clienteHttp';
import type {
  AjusteBody,
  EntradaBody,
  FiltrosInventario,
  PaginaInventario,
  RespuestaKardex,
  RespuestaResumenInventario,
  ResultadoConsistencia,
  SimulacionMovimiento,
  SimularInput,
} from './tipos';

function query(f: FiltrosInventario): string {
  const qs = new URLSearchParams();
  if (f.texto) qs.set('texto', f.texto);
  if (f.idCategoria !== undefined) qs.set('idCategoria', String(f.idCategoria));
  if (f.idProducto !== undefined) qs.set('idProducto', String(f.idProducto));
  if (f.filtro) qs.set('filtro', f.filtro);
  if (f.orden) qs.set('orden', f.orden);
  if (f.direccion) qs.set('direccion', f.direccion);
  qs.set('pagina', String(f.pagina));
  qs.set('tamano', String(f.tamano));
  return `?${qs.toString()}`;
}

/** Tablero de inventario por variante (Operador/Administrador). */
export function listarInventarioAdmin(filtros: FiltrosInventario): Promise<PaginaInventario> {
  return peticion<PaginaInventario>(`/api/v1/inventario/admin${query(filtros)}`);
}

/** KPIs del tablero + movimientos de hoy por tipo. */
export function obtenerResumenInventario(): Promise<RespuestaResumenInventario> {
  return peticion<RespuestaResumenInventario>('/api/v1/inventario/resumen');
}

/** Vista previa (solo lectura) de un movimiento: Permitido + Motivo. */
export function simularMovimiento(datos: SimularInput): Promise<SimulacionMovimiento> {
  return peticion<SimulacionMovimiento>('/api/v1/inventario/simular', { method: 'POST', body: datos });
}

/** Registra una entrada de compra (ENTRADA_COMPRA). */
export function registrarEntrada(datos: EntradaBody): Promise<unknown> {
  return peticion('/api/v1/inventario/entradas', { method: 'POST', body: datos });
}

/** Registra un ajuste (AJUSTE_POSITIVO | AJUSTE_NEGATIVO). */
export function registrarAjuste(datos: AjusteBody): Promise<unknown> {
  return peticion('/api/v1/inventario/ajustes', { method: 'POST', body: datos });
}

/** Kardex de una variante con paginacion. */
export function listarKardex(idVariante: number, pagina = 1, tamanoPagina = 20): Promise<RespuestaKardex> {
  return peticion<RespuestaKardex>(
    `/api/v1/inventario/variantes/${idVariante}/kardex?pagina=${pagina}&tamanoPagina=${tamanoPagina}`,
  );
}

/** Auditoria del invariante Existencia = SUM(kardex) (solo Administrador). */
export function verificarConsistencia(): Promise<ResultadoConsistencia> {
  return peticion<ResultadoConsistencia>('/api/v1/inventario/consistencia');
}
