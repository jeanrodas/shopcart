import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Boton } from '../../componentes/ui/Boton';
import type { Categoria } from '../../api/tipos';
import type { EstadoFiltros } from './estado';

const RANGO_MAX = 500;
const RANGO_PASO = 10;

interface Props {
  categorias: Categoria[];
  filtros: EstadoFiltros;
  cuponCard: ReactNode;
  /** panel (escritorio): categoria y existencia se aplican al instante. hoja (movil): todo junto. */
  instantaneo: boolean;
  /** Total de la busqueda vigente (para el boton "Ver N productos" de la hoja). */
  total: number;
  onAplicar: (cambios: Partial<EstadoFiltros>) => void;
  onCerrar?: () => void;
}

function numeroDesde(valor: string): number | undefined {
  if (valor.trim() === '') return undefined;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function Filtros({ categorias, filtros, cuponCard, instantaneo, total, onAplicar, onCerrar }: Props) {
  const [draft, setDraft] = useState<EstadoFiltros>(filtros);
  useEffect(() => setDraft(filtros), [filtros]);

  const rangoError =
    draft.precioMin !== undefined && draft.precioMax !== undefined && draft.precioMin > draft.precioMax;

  const visibles = categorias.filter((c) => c.ProductosVisibles > 0);

  const cambiarCategoria = (id: number | undefined) => {
    setDraft((d) => ({ ...d, idCategoria: id }));
    if (instantaneo) onAplicar({ idCategoria: id });
  };
  const cambiarDisponibles = (v: boolean) => {
    setDraft((d) => ({ ...d, soloDisponibles: v }));
    if (instantaneo) onAplicar({ soloDisponibles: v });
  };

  const aplicar = () => {
    if (rangoError) return;
    if (instantaneo) {
      onAplicar({ precioMin: draft.precioMin, precioMax: draft.precioMax });
    } else {
      onAplicar({
        idCategoria: draft.idCategoria,
        soloDisponibles: draft.soloDisponibles,
        precioMin: draft.precioMin,
        precioMax: draft.precioMax,
      });
      onCerrar?.();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-20 border border-borde bg-white p-5 shadow-suave">
        {/* Categoria (seleccion unica) */}
        <fieldset>
          <legend className="mb-2 text-sm font-extrabold text-marino-900">Categoría</legend>
          <div role="radiogroup" aria-label="Categoría" className="flex flex-col">
            <OpcionCategoria
              nombre="Todas"
              marcado={draft.idCategoria === undefined}
              onClick={() => cambiarCategoria(undefined)}
            />
            {visibles.map((c) => (
              <OpcionCategoria
                key={c.IDCategoria}
                nombre={c.Nombre}
                contador={c.ProductosVisibles}
                marcado={draft.idCategoria === c.IDCategoria}
                onClick={() => cambiarCategoria(c.IDCategoria)}
              />
            ))}
          </div>
        </fieldset>

        <hr className="border-borde" />

        {/* Precio */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-extrabold text-marino-900">Precio</span>
          <input
            type="range"
            className="rango-precio"
            min={0}
            max={RANGO_MAX}
            step={RANGO_PASO}
            value={draft.precioMax ?? RANGO_MAX}
            aria-label="Precio máximo"
            onChange={(e) => {
              const v = Number(e.target.value);
              setDraft((d) => ({ ...d, precioMax: v >= RANGO_MAX ? undefined : v }));
            }}
          />
          <div className="flex items-center gap-2">
            <CampoPrecio
              etiqueta="Mínimo"
              valor={draft.precioMin}
              onCambio={(v) => setDraft((d) => ({ ...d, precioMin: v }))}
            />
            <span className="mt-5 text-apagado">—</span>
            <CampoPrecio
              etiqueta="Máximo"
              valor={draft.precioMax}
              onCambio={(v) => setDraft((d) => ({ ...d, precioMax: v }))}
            />
          </div>
          {rangoError && (
            <p className="text-xs font-medium text-error-texto">
              El mínimo no puede ser mayor que el máximo.
            </p>
          )}
        </div>

        <hr className="border-borde" />

        {/* Solo con existencia */}
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[rgba(15,23,42,.3)] text-marino-600 accent-marino-600"
            checked={draft.soloDisponibles}
            onChange={(e) => cambiarDisponibles(e.target.checked)}
          />
          <span className="text-sm font-semibold text-texto">Solo con existencia</span>
        </label>

        <Boton onClick={aplicar} disabled={rangoError} className="w-full">
          {instantaneo ? 'Aplicar filtros' : `Ver ${total} productos`}
        </Boton>
      </div>

      {cuponCard}
    </div>
  );
}

function OpcionCategoria({
  nombre,
  contador,
  marcado,
  onClick,
}: {
  nombre: string;
  contador?: number;
  marcado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      onClick={onClick}
      className="flex items-center justify-between gap-2 rounded-12 px-2 py-2 text-left hover:bg-fondo-2"
    >
      <span className="flex items-center gap-2.5">
        <span
          className={clsx(
            'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2',
            marcado ? 'border-marino-600' : 'border-[rgba(15,23,42,.3)]',
          )}
        >
          {marcado && <span className="h-2.5 w-2.5 rounded-full bg-marino-600" />}
        </span>
        <span className={clsx('text-sm', marcado ? 'font-semibold text-marino-900' : 'text-texto')}>
          {nombre}
        </span>
      </span>
      {contador !== undefined && <span className="text-xs text-apagado">{contador}</span>}
    </button>
  );
}

function CampoPrecio({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: number | undefined;
  onCambio: (v: number | undefined) => void;
}) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-xs font-semibold text-apagado">{etiqueta}</span>
      <div className="flex items-center rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 focus-within:border-marino-600">
        <span className="text-sm text-apagado">Q</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={valor ?? ''}
          onChange={(e) => onCambio(numeroDesde(e.target.value))}
          className="w-full bg-transparent px-1.5 py-2 text-sm text-texto outline-none"
          placeholder={etiqueta === 'Mínimo' ? '0' : '500'}
        />
      </div>
    </label>
  );
}
