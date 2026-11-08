import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** aria-label del dialogo (el contenido suele traer su propia cabecera y boton de cerrar). */
  etiqueta?: string;
  /** Se pasa al contenedor del panel (p. ej. data-testid para pruebas). */
  testid?: string;
  children: ReactNode;
}

const FOCO = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Panel deslizante (slide-over) desde la derecha: 560 px en escritorio y pantalla completa
 * en movil (<640 px el ancho es el de la pantalla). Overlay que cierra al clic, Escape para
 * cerrar y foco atrapado dentro mientras esta abierto. Compartido por el editor de productos
 * y el panel de movimiento de inventario.
 */
export function PanelLateral({ abierto, onCerrar, etiqueta, testid, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const panel = ref.current;
    // Enfoca el panel al abrir (para que Escape y el ciclo de Tab funcionen de inmediato).
    panel?.focus();
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const foco = Array.from(panel.querySelectorAll<HTMLElement>(FOCO)).filter((el) => el.offsetParent !== null);
      if (foco.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const primero = foco[0]!;
      const ultimo = foco[foco.length - 1]!;
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === panel)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alTecla);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTecla);
      document.body.style.overflow = prevOverflow;
    };
  }, [abierto, onCerrar]);

  return (
    <div className={clsx('fixed inset-0 z-50 overflow-hidden', !abierto && 'pointer-events-none')} aria-hidden={!abierto}>
      <div
        className={clsx('absolute inset-0 bg-marino-900/50 transition-opacity', abierto ? 'opacity-100' : 'opacity-0')}
        onClick={onCerrar}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        data-testid={testid}
        tabIndex={-1}
        className={clsx(
          'absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-fondo shadow-elevada outline-none transition-transform',
          abierto ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {abierto && children}
      </div>
    </div>
  );
}
