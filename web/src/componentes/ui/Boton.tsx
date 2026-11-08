import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';
export type TamanoBoton = 'md' | 'lg';

const VARIANTES: Record<VarianteBoton, string> = {
  primario:
    'bg-degradado-acento text-marino-900 font-extrabold shadow-acento hover:brightness-105 hover:-translate-y-px',
  secundario: 'bg-marino-700 text-white font-semibold hover:bg-marino-600',
  fantasma:
    'bg-white text-marino-700 font-semibold border-[1.5px] border-[rgba(15,23,42,.14)] hover:bg-fondo-2',
  peligro: 'bg-error text-white font-semibold hover:brightness-105',
};

const TAMANOS: Record<TamanoBoton, string> = {
  md: 'min-h-[44px] px-5 text-sm',
  lg: 'min-h-[52px] px-7 text-base',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill transition-[transform,filter,background-color] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:brightness-100';

/** Clases de boton reutilizables (para botones reales y para enlaces con estilo de boton). */
export function clasesBoton(variante: VarianteBoton = 'primario', tamano: TamanoBoton = 'md'): string {
  return clsx(BASE, VARIANTES[variante], TAMANOS[tamano]);
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  cargando?: boolean;
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  disabled,
  className,
  children,
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={clsx(clasesBoton(variante, tamano), className)}
      // Cualquiera de los dos deshabilita: un `disabled={false}` explicito no debe permitir
      // re-enviar mientras `cargando` (evita el doble submit). Antes usaba `??` y lo ignoraba.
      disabled={(disabled ?? false) || cargando}
      aria-busy={cargando || undefined}
      {...resto}
    >
      {cargando ? (
        <>
          <Spinner />
          Procesando…
        </>
      ) : (
        children
      )}
    </button>
  );
}
