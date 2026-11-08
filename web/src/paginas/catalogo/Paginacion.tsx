import clsx from 'clsx';
import { IconoFlechaDerecha, IconoFlechaIzquierda } from '../../componentes/iconos';
import { TAMANOS_PAGINA } from './estado';

/** Tamaños de página de las tablas del área interna (su defecto es 20). */
export const TAMANOS_PAGINA_ADMIN = [20, 50, 100] as const;

interface Props {
  pagina: number;
  tamanoPagina: number;
  total: number;
  onPagina: (p: number) => void;
  onTamano: (t: number) => void;
  /** Opciones del selector "Por página"; por defecto las de la tienda (12/24/48). */
  tamanos?: readonly number[];
}

/** Ventana de 5 numeros alrededor de la pagina actual, con 1, total y "…". */
function ventana(pagina: number, totalPaginas: number): (number | '…')[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const items: (number | '…')[] = [1];
  const ini = Math.max(2, pagina - 2);
  const fin = Math.min(totalPaginas - 1, pagina + 2);
  if (ini > 2) items.push('…');
  for (let p = ini; p <= fin; p++) items.push(p);
  if (fin < totalPaginas - 1) items.push('…');
  items.push(totalPaginas);
  return items;
}

const BTN = 'grid h-11 min-w-11 place-items-center rounded-12 px-3 text-sm font-semibold';

export function Paginacion({
  pagina,
  tamanoPagina,
  total,
  onPagina,
  onTamano,
  tamanos = TAMANOS_PAGINA,
}: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * tamanoPagina + 1;
  const hasta = Math.min(pagina * tamanoPagina, total);

  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-apagado">
        Mostrando <strong className="text-marino-900">{desde}</strong>–
        <strong className="text-marino-900">{hasta}</strong> de{' '}
        <strong className="text-marino-900">{total}</strong>
      </p>

      {totalPaginas > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginación">
          <button
            type="button"
            className={clsx(BTN, 'border border-borde bg-white disabled:opacity-40')}
            onClick={() => onPagina(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
          >
            <IconoFlechaIzquierda className="h-4 w-4" />
          </button>
          {ventana(pagina, totalPaginas).map((it, i) =>
            it === '…' ? (
              <span key={`e${i}`} className="px-1 text-apagado">
                …
              </span>
            ) : (
              <button
                key={it}
                type="button"
                onClick={() => onPagina(it)}
                aria-current={it === pagina ? 'page' : undefined}
                className={clsx(
                  BTN,
                  it === pagina
                    ? 'bg-marino-700 text-white'
                    : 'border border-borde bg-white text-marino-700 hover:bg-fondo-2',
                )}
              >
                {it}
              </button>
            ),
          )}
          <button
            type="button"
            className={clsx(BTN, 'border border-borde bg-white disabled:opacity-40')}
            onClick={() => onPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
            aria-label="Página siguiente"
          >
            <IconoFlechaDerecha className="h-4 w-4" />
          </button>
        </nav>
      )}

      <label className="flex items-center gap-2 text-sm text-apagado">
        Por página
        <select
          value={tamanoPagina}
          onChange={(e) => onTamano(Number(e.target.value))}
          className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-3 py-1.5 text-sm font-semibold text-marino-700 outline-none focus:border-marino-600"
        >
          {tamanos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
