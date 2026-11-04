import { formatearFechaCorta } from '../../lib/formato';
import { formatearQuetzales } from '../../componentes/ui/Precio';
import type { CuponVigente } from '../../api/tipos';

/** Descripcion del cupon tal como la define la propuesta (cifras tal cual vienen del cupon). */
function describir(c: CuponVigente): string {
  const hasta = `hasta el ${formatearFechaCorta(c.FechaFin)}`;
  const enCategoria = c.Categoria ? ` en ${c.Categoria}` : '';
  if (c.TipoDescuento === 'PORCENTAJE') {
    return `${c.Valor} %${enCategoria} ${hasta}`;
  }
  const desde = c.MontoMinimo > 0 ? ` en compras desde ${formatearQuetzales(c.MontoMinimo)}` : '';
  return `${formatearQuetzales(c.Valor)} de descuento${enCategoria}${desde} ${hasta}`;
}

/** Tarjeta degradado marino con el cupon vigente de la categoria (o el general). */
export function CuponCard({ cupon }: { cupon: CuponVigente | undefined }) {
  if (!cupon) return null;
  return (
    <div className="flex flex-col gap-2 rounded-16 bg-degradado-marino p-4 text-white shadow-marino">
      <span className="text-[11px] font-semibold uppercase tracking-ancho text-white/70">
        Cupón vigente
      </span>
      <span className="font-mono text-lg font-bold tracking-ancho text-dorado">{cupon.Codigo}</span>
      <p className="text-sm font-semibold">{describir(cupon)}</p>
      <p className="text-[12px] text-white/60">Se aplica en el carrito</p>
    </div>
  );
}
