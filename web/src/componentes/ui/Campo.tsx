import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconoAlerta } from '../iconos';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  ayuda?: string;
  error?: string;
  /** Elemento al final del campo (p. ej. el boton de mostrar/ocultar contrasena). */
  sufijo?: ReactNode;
}

export const Campo = forwardRef<HTMLInputElement, Props>(function Campo(
  { label, ayuda, error, sufijo, id, className, ...resto },
  ref,
) {
  const generado = useId();
  const campoId = id ?? generado;
  const errorId = `${campoId}-error`;
  const ayudaId = `${campoId}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={campoId} className="text-sm font-semibold text-texto">
        {label}
      </label>
      <div className="relative">
        <input
          id={campoId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={clsx(error && errorId, !error && ayuda && ayudaId) || undefined}
          className={clsx(
            'w-full rounded-12 border bg-white px-3.5 py-2.5 text-sm text-texto outline-none transition-colors placeholder:text-apagado',
            error
              ? 'border-error focus:border-error'
              : 'border-[rgba(15,23,42,.14)] focus:border-marino-600',
            'disabled:cursor-not-allowed disabled:bg-fondo-2',
            sufijo && 'pr-11',
            className,
          )}
          {...resto}
        />
        {sufijo && <div className="absolute inset-y-0 right-2 flex items-center">{sufijo}</div>}
      </div>
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-xs font-medium text-error-texto">
          <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : ayuda ? (
        <p id={ayudaId} className="text-xs text-apagado">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
});
