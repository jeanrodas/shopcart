import type { BusquedaParams } from '../../api/tipos';

export type Orden = 'Nombre' | 'Precio' | 'FechaCreacion';
export type Direccion = 'ASC' | 'DESC';

/** Filtros resueltos (con defaults) que viven en la URL del catalogo. */
export interface EstadoFiltros {
  texto?: string;
  idCategoria?: number;
  precioMin?: number;
  precioMax?: number;
  soloDisponibles: boolean;
  orden: Orden;
  direccion: Direccion;
  pagina: number;
  tamanoPagina: number;
}

export const TAMANOS_PAGINA = [12, 24, 48] as const;
export const TAMANO_DEFECTO = 12;

/** Opciones del selector "Ordenar por". El valor es la clave usada en el <select>.
 *  "Nombre A–Z" (Nombre/ASC) es el orden por defecto, por eso va primero. */
export const OPCIONES_ORDEN: { valor: string; etiqueta: string; orden: Orden; direccion: Direccion }[] = [
  { valor: 'nombre-az', etiqueta: 'Nombre A–Z', orden: 'Nombre', direccion: 'ASC' },
  { valor: 'precio-asc', etiqueta: 'Precio: menor a mayor', orden: 'Precio', direccion: 'ASC' },
  { valor: 'precio-desc', etiqueta: 'Precio: mayor a menor', orden: 'Precio', direccion: 'DESC' },
  { valor: 'recientes', etiqueta: 'Más recientes', orden: 'FechaCreacion', direccion: 'DESC' },
];

/** Clave del <select> a partir de (orden, direccion). Nombre/ASC (el defecto) -> "nombre-az". */
export function claveOrden(orden: Orden, direccion: Direccion): string {
  if (orden === 'Precio') return direccion === 'DESC' ? 'precio-desc' : 'precio-asc';
  if (orden === 'FechaCreacion') return 'recientes';
  return 'nombre-az';
}

function numero(valor: string | null): number | undefined {
  if (valor === null || valor.trim() === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) ? n : undefined;
}

/** Lee los filtros desde los query params de la URL. */
export function leerFiltros(sp: URLSearchParams): EstadoFiltros {
  const orden = (['Nombre', 'Precio', 'FechaCreacion'] as const).find((o) => o === sp.get('orden')) ?? 'Nombre';
  const direccion: Direccion = sp.get('direccion')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const pagina = Math.max(1, Math.trunc(numero(sp.get('pagina')) ?? 1));
  const tamano = numero(sp.get('tamanoPagina'));
  const tamanoPagina = TAMANOS_PAGINA.includes(tamano as (typeof TAMANOS_PAGINA)[number])
    ? (tamano as number)
    : TAMANO_DEFECTO;
  return {
    texto: sp.get('texto')?.trim() || undefined,
    idCategoria: numero(sp.get('idCategoria')),
    precioMin: numero(sp.get('precioMin')),
    precioMax: numero(sp.get('precioMax')),
    soloDisponibles: sp.get('soloDisponibles') === 'true',
    orden,
    direccion,
    pagina,
    tamanoPagina,
  };
}

/** Serializa los filtros a URLSearchParams (omite valores por defecto para una URL limpia). */
export function escribirFiltros(f: EstadoFiltros): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.texto) sp.set('texto', f.texto);
  if (f.idCategoria !== undefined) sp.set('idCategoria', String(f.idCategoria));
  if (f.precioMin !== undefined) sp.set('precioMin', String(f.precioMin));
  if (f.precioMax !== undefined) sp.set('precioMax', String(f.precioMax));
  if (f.soloDisponibles) sp.set('soloDisponibles', 'true');
  if (f.orden !== 'Nombre') sp.set('orden', f.orden);
  if (f.direccion !== 'ASC') sp.set('direccion', f.direccion);
  if (f.pagina !== 1) sp.set('pagina', String(f.pagina));
  if (f.tamanoPagina !== TAMANO_DEFECTO) sp.set('tamanoPagina', String(f.tamanoPagina));
  return sp;
}

/** Filtros -> parametros de la API (son el mismo shape). */
export function aParams(f: EstadoFiltros): BusquedaParams {
  return {
    texto: f.texto,
    idCategoria: f.idCategoria,
    precioMin: f.precioMin,
    precioMax: f.precioMax,
    soloDisponibles: f.soloDisponibles,
    orden: f.orden,
    direccion: f.direccion,
    pagina: f.pagina,
    tamanoPagina: f.tamanoPagina,
  };
}

/** Cuántos filtros "de contenido" hay activos (para el contador del boton movil). */
export function contarActivos(f: EstadoFiltros): number {
  let n = 0;
  if (f.idCategoria !== undefined) n++;
  if (f.precioMin !== undefined) n++;
  if (f.precioMax !== undefined) n++;
  if (f.soloDisponibles) n++;
  if (f.texto) n++;
  return n;
}
