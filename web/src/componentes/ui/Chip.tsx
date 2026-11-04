import { type ReactNode } from 'react';
import clsx from 'clsx';
import { IconoCerrar } from '../iconos';

interface Props {
  children: ReactNode;
  alQuitar?: () => void;
  className?: string;
}

/** Chip de filtro activo, opcionalmente removible. */
export function Chip({ children, alQuitar, className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill bg-marino-600/10 px-3 py-1 text-xs font-semibold text-marino-700',
        className,
      )}
    >
      {children}
      {alQuitar && (
        <button
          type="button"
          onClick={alQuitar}
          aria-label="Quitar filtro"
          className="grid h-4 w-4 place-items-center rounded-pill hover:bg-marino-600/20"
        >
          <IconoCerrar className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
