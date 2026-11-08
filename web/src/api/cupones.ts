import { peticion } from './clienteHttp';
import type {
  CuponAdminFila,
  CuponBody,
  CuponVigente,
  FiltrosCupones,
  PaginaCupones,
  ResumenCupones,
} from './tipos';

export function obtenerCuponesVigentes(): Promise<{ cupones: CuponVigente[] }> {
  return peticion<{ cupones: CuponVigente[] }>('/api/v1/cupones/vigentes');
}

/* ---------------------------- Administracion (F8) ------------------------- */

function query(f: FiltrosCupones): string {
  const qs = new URLSearchParams();
  if (f.texto) qs.set('texto', f.texto);
  if (f.filtro) qs.set('filtro', f.filtro);
  if (f.orden) qs.set('orden', f.orden);
  if (f.direccion) qs.set('direccion', f.direccion);
  qs.set('pagina', String(f.pagina));
  qs.set('tamano', String(f.tamano));
  return `?${qs.toString()}`;
}

export function listarCuponesAdmin(filtros: FiltrosCupones): Promise<PaginaCupones> {
  return peticion<PaginaCupones>(`/api/v1/cupones/admin${query(filtros)}`);
}

export function obtenerResumenCupones(): Promise<ResumenCupones> {
  return peticion<ResumenCupones>('/api/v1/cupones/resumen');
}

export function crearCupon(body: CuponBody): Promise<CuponAdminFila> {
  return peticion<CuponAdminFila>('/api/v1/cupones', { method: 'POST', body });
}

export function actualizarCupon(id: number, body: CuponBody): Promise<CuponAdminFila> {
  return peticion<CuponAdminFila>(`/api/v1/cupones/${id}`, { method: 'PUT', body });
}

export function cambiarEstadoCupon(id: number, activo: boolean): Promise<CuponAdminFila> {
  return peticion<CuponAdminFila>(`/api/v1/cupones/${id}/estado`, { method: 'PATCH', body: { activo } });
}
