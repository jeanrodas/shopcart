import clsx from 'clsx';
import type { Direccion } from '../../api/tipos';

interface Props {
  dir: Direccion;
  ultima: boolean;
  puedeEliminar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  // Modo "seleccionable" (checkout): radio a la izquierda. Omitido en "Mi cuenta".
  seleccionada?: boolean;
  onSeleccionar?: () => void;
}

/** Tarjeta de direccion compartida por checkout (seleccionable) y "Mi cuenta" (solo gestion). */
export function TarjetaDireccion({
  dir,
  ultima,
  puedeEliminar,
  onEditar,
  onEliminar,
  seleccionada,
  onSeleccionar,
}: Props) {
  const seleccionable = typeof onSeleccionar === 'function';
  return (
    <div
      className={clsx(
        'rounded-16 border p-4 transition-colors',
        seleccionada ? 'border-marino-700 bg-marino-600/5' : 'border-[rgba(15,23,42,.14)] bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        {seleccionable && (
          <button
            type="button"
            onClick={onSeleccionar}
            aria-pressed={seleccionada}
            aria-label={`Usar ${dir.Alias}`}
            className={clsx(
              'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-pill border',
              seleccionada ? 'border-marino-700' : 'border-apagado',
            )}
          >
            {seleccionada && <span className="h-2 w-2 rounded-pill bg-marino-700" />}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-bold text-marino-900">
            {dir.Alias}
            {ultima && (
              <span className="rounded-pill bg-marino-600/10 px-2 py-0.5 text-[10px] font-semibold text-marino-700">
                Última usada
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-texto">
            {dir.NombreReceptor} · {dir.Telefono} · {dir.Linea1}
          </p>
          {dir.Linea2 && <p className="text-sm text-apagado">{dir.Linea2}</p>}
          <p className="text-sm text-apagado">
            {dir.Municipio}, {dir.Departamento}
            {dir.Referencia ? ` · ${dir.Referencia}` : ''}
          </p>
          <div className="mt-2 flex gap-4 text-xs font-semibold">
            <button type="button" onClick={onEditar} className="text-marino-700 hover:underline">
              Editar
            </button>
            {puedeEliminar && (
              <button type="button" onClick={onEliminar} className="text-error-texto hover:underline">
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
