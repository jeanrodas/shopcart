import { peticion } from './clienteHttp';
import type { BitacoraEvento, FiltrosBitacora, PaginaBitacora } from './tipos';

function query(f: FiltrosBitacora): string {
  const qs = new URLSearchParams();
  if (f.modulo) qs.set('modulo', f.modulo);
  if (f.entidad) qs.set('entidad', f.entidad);
  if (f.idEntidad !== undefined) qs.set('idEntidad', String(f.idEntidad));
  if (f.idUsuario !== undefined) qs.set('idUsuario', String(f.idUsuario));
  if (f.accion) qs.set('accion', f.accion);
  if (f.desde) qs.set('desde', f.desde);
  if (f.hasta) qs.set('hasta', f.hasta);
  if (f.texto) qs.set('texto', f.texto);
  if (f.orden) qs.set('orden', f.orden);
  if (f.direccion) qs.set('direccion', f.direccion);
  qs.set('pagina', String(f.pagina));
  qs.set('tamano', String(f.tamano));
  return `?${qs.toString()}`;
}

export function listarBitacora(filtros: FiltrosBitacora): Promise<PaginaBitacora> {
  return peticion<PaginaBitacora>(`/api/v1/bitacora${query(filtros)}`);
}

export function listarModulosBitacora(): Promise<string[]> {
  return peticion<string[]>('/api/v1/bitacora/modulos');
}

/** Todos los eventos de un registro (Entidad + IDEntidad). */
export function listarEventosRegistro(tabla: string, idRegistro: number): Promise<{ filas: BitacoraEvento[] }> {
  const qs = new URLSearchParams({ tabla, idRegistro: String(idRegistro) });
  return peticion<{ filas: BitacoraEvento[] }>(`/api/v1/bitacora/registro?${qs.toString()}`);
}
