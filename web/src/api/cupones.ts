import { peticion } from './clienteHttp';
import type { CuponVigente } from './tipos';

export function obtenerCuponesVigentes(): Promise<{ cupones: CuponVigente[] }> {
  return peticion<{ cupones: CuponVigente[] }>('/api/v1/cupones/vigentes');
}
