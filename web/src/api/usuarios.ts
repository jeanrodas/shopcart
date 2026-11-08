import { peticion } from './clienteHttp';
import type {
  FiltrosUsuarios,
  PaginaUsuarios,
  UsuarioAdminFila,
  UsuarioCreado,
  UsuarioInternoBody,
} from './tipos';

function query(f: FiltrosUsuarios): string {
  const qs = new URLSearchParams();
  if (f.texto) qs.set('texto', f.texto);
  if (f.idRol !== undefined) qs.set('idRol', String(f.idRol));
  if (f.filtro) qs.set('filtro', f.filtro);
  if (f.orden) qs.set('orden', f.orden);
  if (f.direccion) qs.set('direccion', f.direccion);
  qs.set('pagina', String(f.pagina));
  qs.set('tamano', String(f.tamano));
  return `?${qs.toString()}`;
}

export function listarUsuariosAdmin(filtros: FiltrosUsuarios): Promise<PaginaUsuarios> {
  return peticion<PaginaUsuarios>(`/api/v1/usuarios/admin${query(filtros)}`);
}

/** Crea un usuario interno; el servidor devuelve la contrasena temporal una sola vez. */
export function crearUsuarioInterno(body: UsuarioInternoBody): Promise<UsuarioCreado> {
  return peticion<UsuarioCreado>('/api/v1/usuarios', { method: 'POST', body });
}

export function cambiarRolUsuario(id: number, idRol: number): Promise<UsuarioAdminFila> {
  return peticion<UsuarioAdminFila>(`/api/v1/usuarios/${id}/rol`, { method: 'PATCH', body: { idRol } });
}

export function cambiarEstadoUsuario(id: number, activo: boolean): Promise<UsuarioAdminFila> {
  return peticion<UsuarioAdminFila>(`/api/v1/usuarios/${id}/estado`, { method: 'PATCH', body: { activo } });
}

export function desbloquearUsuario(id: number): Promise<UsuarioAdminFila> {
  return peticion<UsuarioAdminFila>(`/api/v1/usuarios/${id}/desbloquear`, { method: 'POST' });
}
