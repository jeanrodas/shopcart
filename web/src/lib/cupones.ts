import type { CuponVigente } from '../api/tipos';

/**
 * Helpers de presentacion de cupones vigentes (de /cupones/vigentes). El front NUNCA
 * calcula el precio con cupon: solo decide que insignia o tarjeta mostrar. El descuento
 * real lo calcula la BD en el carrito.
 */

/** Cupon PORCENTAJE vigente de una categoria (el de mayor valor). Base de las insignias. */
export function cuponPorcentajeDeCategoria(
  cupones: CuponVigente[] | undefined,
  idCategoria: number | undefined,
): CuponVigente | undefined {
  if (!cupones || idCategoria === undefined) return undefined;
  return cupones
    .filter((c) => c.IDCategoria === idCategoria && c.TipoDescuento === 'PORCENTAJE')
    .sort((a, b) => b.Valor - a.Valor)[0];
}

/** Cualquier cupon vigente de una categoria (PORCENTAJE o MONTO) para la tarjeta del panel. */
export function cuponDeCategoria(
  cupones: CuponVigente[] | undefined,
  idCategoria: number | undefined,
): CuponVigente | undefined {
  if (!cupones || idCategoria === undefined) return undefined;
  return cupones.find((c) => c.IDCategoria === idCategoria);
}

/** Cupon general (sin categoria), p. ej. PROMO10. */
export function cuponGeneral(cupones: CuponVigente[] | undefined): CuponVigente | undefined {
  return cupones?.find((c) => c.IDCategoria === null);
}

/** Texto de la insignia de cupon PORCENTAJE: "-15 % con ADIT15". */
export function textoInsigniaCupon(c: CuponVigente): string {
  return `-${c.Valor} % con ${c.Codigo}`;
}
