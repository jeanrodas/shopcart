import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { IconoCerrar } from '../../componentes/iconos';

const SELECTOR_ENFOCABLES =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])';

interface Props {
  titulo: string;
  children: ReactNode;
  onCerrar: () => void;
}

/** Hoja inferior (bottom sheet) con fondo oscurecido, asa, cierre por Escape/toque fuera y foco atrapado. */
export function HojaInferior({ titulo, children, onCerrar }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  const alTeclear = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const enfocables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES));
      if (enfocables.length === 0) return;
      const primero = enfocables[0]!;
      const ultimo = enfocables[enfocables.length - 1]!;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    },
    [onCerrar],
  );

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(SELECTOR_ENFOCABLES)?.focus();
    return () => previo?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-marino-900/50 lg:hidden" onClick={onCerrar}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onKeyDown={alTeclear}
        onClick={(e) => e.stopPropagation()}
        className="anim-fade max-h-[85vh] w-full overflow-y-auto rounded-t-28 bg-fondo p-4 shadow-elevada"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-pill bg-[rgba(15,23,42,.18)]" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-pill text-apagado hover:bg-fondo-2"
          >
            <IconoCerrar className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
