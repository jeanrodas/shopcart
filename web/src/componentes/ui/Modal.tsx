import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Boton, type VarianteBoton } from './Boton';
import { IconoCerrar } from '../iconos';

interface Props {
  abierto: boolean;
  titulo: string;
  children?: ReactNode;
  /** Icono opcional (p. ej. en circulo de color) junto al titulo. */
  icono?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  varianteConfirmar?: VarianteBoton;
  cargando?: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
  /**
   * Cierre por descarte (X, Escape, clic fuera). Si se omite, descartar equivale a
   * `alCancelar`. Util cuando el boton "Cancelar" hace una accion (no solo cerrar).
   */
  alCerrar?: () => void;
}

const SELECTOR_ENFOCABLES =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/** Modal de confirmacion con foco atrapado y cierre con Escape. */
export function Modal({
  abierto,
  titulo,
  children,
  icono,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  varianteConfirmar = 'primario',
  cargando = false,
  alConfirmar,
  alCancelar,
  alCerrar,
}: Props) {
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cerrar = alCerrar ?? alCancelar;

  const alTeclear = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrar();
        return;
      }
      if (e.key !== 'Tab' || !dialogoRef.current) return;
      const enfocables = Array.from(
        dialogoRef.current.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES),
      );
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
    [cerrar],
  );

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const dialogo = dialogoRef.current;
    dialogo?.querySelector<HTMLElement>(SELECTOR_ENFOCABLES)?.focus();
    return () => previo?.focus();
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-marino-900/50 p-4"
      onClick={cerrar}
    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
        onClick={(e) => e.stopPropagation()}
        className="anim-fade w-full max-w-md rounded-20 bg-white p-6 shadow-elevada"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {icono}
            <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">{titulo}</h2>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-pill text-apagado hover:bg-fondo-2"
          >
            <IconoCerrar className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="mb-5 text-sm text-apagado">{children}</div>}
        <div className="flex justify-end gap-3">
          <Boton variante="fantasma" onClick={alCancelar}>
            {textoCancelar}
          </Boton>
          <Boton variante={varianteConfirmar} onClick={alConfirmar} cargando={cargando}>
            {textoConfirmar}
          </Boton>
        </div>
      </div>
    </div>
  );
}
