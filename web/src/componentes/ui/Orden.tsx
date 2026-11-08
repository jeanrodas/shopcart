import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';

export type Direccion = 'ASC' | 'DESC';

export interface EstadoOrden<C extends string> {
  orden: C;
  direccion: Direccion;
  alOrdenar: (col: C) => void;
}

/**
 * Ordenamiento del lado del servidor, persistido en la URL (?orden=&direccion=) para que
 * sobreviva a una recarga y al compartir el enlace. Un clic en la columna activa alterna la
 * direccion; en otra columna ordena ascendente. El valor se valida contra la lista blanca de
 * columnas (el backend lo revalida y responde 422 si no pertenece). Conserva el resto de la
 * query (p. ej. ?producto=).
 */
export function useOrdenURL<C extends string>(
  columnas: readonly C[],
  porDefecto: { orden: C; direccion: Direccion },
): EstadoOrden<C> {
  const [sp, setSp] = useSearchParams();
  const ordenRaw = sp.get('orden');
  const orden = (columnas as readonly string[]).includes(ordenRaw ?? '') ? (ordenRaw as C) : porDefecto.orden;
  const dirRaw = sp.get('direccion');
  const direccion: Direccion = dirRaw === 'ASC' || dirRaw === 'DESC' ? dirRaw : porDefecto.direccion;

  const alOrdenar = (col: C) => {
    const mismaCol = col === orden;
    const siguiente: Direccion = mismaCol ? (direccion === 'ASC' ? 'DESC' : 'ASC') : 'ASC';
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('orden', col);
        next.set('direccion', siguiente);
        return next;
      },
      { replace: true },
    );
  };

  return { orden, direccion, alOrdenar };
}

/** Encabezado de tabla ordenable: boton con indicador ▲/▼ y aria-sort. */
export function ThOrden<C extends string>({
  col,
  estado,
  children,
  className,
  alinearDerecha,
}: {
  col: C;
  estado: EstadoOrden<C>;
  children: ReactNode;
  className?: string;
  alinearDerecha?: boolean;
}) {
  const activo = estado.orden === col;
  return (
    <th className={className} aria-sort={activo ? (estado.direccion === 'ASC' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => estado.alOrdenar(col)}
        className={clsx(
          'inline-flex items-center gap-1 uppercase tracking-ancho transition-colors hover:text-marino-700',
          activo && 'text-marino-700',
          alinearDerecha && 'flex-row-reverse',
        )}
      >
        {children}
        <span aria-hidden className={clsx('text-[10px] leading-none', !activo && 'opacity-40')}>
          {activo ? (estado.direccion === 'ASC' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
