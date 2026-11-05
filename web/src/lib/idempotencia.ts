/**
 * Clave de idempotencia del pago (RF-06: "no genera dos pedidos"). Se guarda en
 * sessionStorage junto con una FIRMA del carrito reservado (IDCarrito + variantes y
 * cantidades). La MISMA clave se reutiliza en todos los reintentos del mismo intento
 * (doble clic, falla de red, boton "Reintentar"): el servidor responde el mismo
 * pedido con replay=true. Se genera una clave NUEVA solo cuando cambia la firma del
 * carrito o cuando el intento anterior quedo consumido (pago aprobado o rechazado).
 */

const CLAVE = 'shopcart.idem';

interface Guardado {
  clave: string;
  firma: string;
}

/** Firma estable del carrito reservado: IDCarrito + "IDVariante x Cantidad" ordenado. */
export function firmaCarrito(
  idCarrito: number | null | undefined,
  lineas: { IDVariante: number; Cantidad: number }[],
): string {
  const partes = [...lineas]
    .sort((a, b) => a.IDVariante - b.IDVariante)
    .map((l) => `${l.IDVariante}x${l.Cantidad}`)
    .join(',');
  return `${idCarrito ?? 0}:${partes}`;
}

function leer(): Guardado | null {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    return raw ? (JSON.parse(raw) as Guardado) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, firma: string): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ clave, firma }));
  } catch {
    /* sin sessionStorage: la clave vive solo en memoria de esta llamada */
  }
}

/** Clave para esta firma: reutiliza la guardada si la firma coincide, o crea una. */
export function obtenerClaveIdem(firma: string): string {
  const g = leer();
  if (g && g.firma === firma && g.clave) return g.clave;
  const clave = crypto.randomUUID();
  escribir(clave, firma);
  return clave;
}

/** Fuerza una clave nueva (tras un rechazo, que ya consumio la anterior). */
export function nuevaClaveIdem(firma: string): string {
  const clave = crypto.randomUUID();
  escribir(clave, firma);
  return clave;
}

/** Olvida la clave (tras un pago aprobado). */
export function limpiarClaveIdem(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* nada que limpiar */
  }
}
