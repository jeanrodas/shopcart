import { peticion } from './clienteHttp';
import type { Metadatos } from './tipos';

export function obtenerMetadatos(): Promise<Metadatos> {
  return peticion<Metadatos>('/');
}
