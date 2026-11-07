import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useInventarioAdmin, useKardex, useRegistrarMovimiento } from '../../lib/consultas';
import { simularMovimiento } from '../../api/inventario';
import { Boton } from '../../componentes/ui/Boton';
import { Modal } from '../../componentes/ui/Modal';
import { resolverImagen } from '../../lib/imagenes';
import { formatearMomento } from '../../lib/formato';
import { IconoCerrar } from '../../componentes/iconos';
import type { KardexFila, SimulacionMovimiento, TipoMovimiento } from '../../api/tipos';

const TIPOS: { tipo: TipoMovimiento; texto: string }[] = [
  { tipo: 'ENTRADA_COMPRA', texto: 'Entrada de compra' },
  { tipo: 'AJUSTE_POSITIVO', texto: 'Ajuste +' },
  { tipo: 'AJUSTE_NEGATIVO', texto: 'Ajuste −' },
];

/** Color del pill del kardex por tipo de movimiento. */
const PILL_KARDEX: Record<string, string> = {
  ENTRADA_COMPRA: 'bg-exito/10 text-exito-texto',
  SALIDA_VENTA: 'bg-marino-600/10 text-marino-700',
  DEVOLUCION: 'bg-violet-500/10 text-violet-700',
  CANCELACION: 'bg-sky-500/10 text-sky-700',
  AJUSTE_POSITIVO: 'bg-ambar/15 text-naranja-700',
  AJUSTE_NEGATIVO: 'bg-ambar/15 text-naranja-700',
};

function FilaKardex({ k }: { k: KardexFila }) {
  const signo = k.Signo < 0 ? '−' : '+';
  return (
    <li className="flex items-start gap-2 py-2">
      <span className={clsx('mt-0.5 shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-bold', PILL_KARDEX[k.CodigoTipo] ?? 'bg-fondo-2 text-apagado')}>
        {k.CodigoTipo}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-apagado">
          {formatearMomento(k.Fecha)}
          {k.Usuario && <> · {k.Usuario}</>}
          {k.NumeroPedido && <> · {k.NumeroPedido}</>}
        </p>
        {k.Motivo && <p className="truncate text-xs text-texto">{k.Motivo}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={clsx('text-sm font-bold', k.Signo < 0 ? 'text-error-texto' : 'text-exito-texto')}>
          {signo}
          {k.Cantidad}
        </p>
        <p className="text-[11px] text-apagado">→ {k.ExistenciaResultante}</p>
      </div>
    </li>
  );
}

function KardexModal({ idVariante, onCerrar }: { idVariante: number; onCerrar: () => void }) {
  const [pagina, setPagina] = useState(1);
  const { data } = useKardex(idVariante, pagina, 10);
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 10));
  return (
    <Modal
      abierto
      titulo={`Kardex · ${data?.resumen?.SKU ?? ''}`}
      textoConfirmar="Cerrar"
      textoCancelar="Cerrar"
      alConfirmar={onCerrar}
      alCancelar={onCerrar}
    >
      <ul className="flex max-h-[50vh] flex-col divide-y divide-borde overflow-y-auto">
        {(data?.filas ?? []).map((k) => (
          <FilaKardex key={k.IDKardex} k={k} />
        ))}
        {total === 0 && <li className="py-4 text-center text-apagado">Sin movimientos.</li>}
      </ul>
      {totalPaginas > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="rounded-pill border border-borde px-3 py-1.5 font-semibold disabled:opacity-40">
            Anterior
          </button>
          <span className="text-apagado">{pagina} / {totalPaginas}</span>
          <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="rounded-pill border border-borde px-3 py-1.5 font-semibold disabled:opacity-40">
            Siguiente
          </button>
        </div>
      )}
    </Modal>
  );
}

/** Buscador de variante para cuando el panel se abre sin preseleccion ("+ Registrar movimiento"). */
function BuscadorVariante({ onSeleccionar }: { onSeleccionar: (id: number) => void }) {
  const [texto, setTexto] = useState('');
  const [deb, setDeb] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setDeb(texto.trim()), 250);
    return () => window.clearTimeout(t);
  }, [texto]);
  const { data, isPending } = useInventarioAdmin({ texto: deb || undefined, pagina: 1, tamano: 8 });
  return (
    <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
      <h2 className="text-sm font-extrabold uppercase tracking-ancho text-apagado">Registrar movimiento</h2>
      <p className="mt-2 mb-3 text-sm text-apagado">Busca la variante por SKU o producto para registrar su entrada o ajuste.</p>
      <input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por SKU o producto…"
        className="w-full rounded-pill border border-[rgba(15,23,42,.14)] bg-fondo px-4 py-2.5 text-sm outline-none focus:border-marino-600"
      />
      <ul className="mt-3 flex flex-col divide-y divide-borde">
        {(data?.filas ?? []).map((f) => (
          <li key={f.IDVariante}>
            <button
              type="button"
              onClick={() => onSeleccionar(f.IDVariante)}
              className="flex w-full items-center gap-3 rounded-12 px-1 py-2 text-left hover:bg-fondo-2"
            >
              <img src={resolverImagen(f.ImagenPrincipal)} alt="" className="h-10 w-10 shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-marino-900">{f.Producto}</p>
                <p className="truncate font-mono text-xs text-apagado">
                  {f.Presentacion ? `${f.Presentacion} · ` : ''}
                  {f.SKU}
                </p>
              </div>
              <span className="shrink-0 text-xs text-apagado">disp {f.Disponible}</span>
            </button>
          </li>
        ))}
        {!isPending && (data?.filas.length ?? 0) === 0 && (
          <li className="py-4 text-center text-sm text-apagado">Sin coincidencias.</li>
        )}
      </ul>
    </section>
  );
}

interface Props {
  idVariante: number | null;
  tipoInicial: TipoMovimiento;
  onCerrar: () => void;
  /** Si se abre sin variante (p. ej. "+ Registrar movimiento"), permite elegir una aqui. */
  onSeleccionarVariante?: (id: number) => void;
}

export function PanelMovimiento({ idVariante, tipoInicial, onCerrar, onSeleccionarVariante }: Props) {
  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [sim, setSim] = useState<SimulacionMovimiento | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const seq = useRef(0);

  const registrar = useRegistrarMovimiento();
  const { data: kardex } = useKardex(idVariante, 1, 5);
  const resumen = kardex?.resumen ?? null;

  // Al cambiar de variante o de chip inicial, reinicia el formulario.
  useEffect(() => {
    setTipo(tipoInicial);
    setCantidad('');
    setMotivo('');
    setSim(null);
  }, [idVariante, tipoInicial]);

  const cant = Number(cantidad);
  const cantValida = Number.isInteger(cant) && cant > 0 && cant <= 100000;

  // Simulacion con debounce 250 ms: la cifra resultante SIEMPRE viene de la API.
  useEffect(() => {
    if (idVariante === null || !cantValida) {
      setSim(null);
      setSimulando(false);
      return;
    }
    const id = ++seq.current;
    setSimulando(true);
    const t = window.setTimeout(() => {
      simularMovimiento({ idVariante, tipo, cantidad: cant })
        .then((r) => {
          if (id === seq.current) setSim(r);
        })
        .catch(() => {
          if (id === seq.current) setSim(null);
        })
        .finally(() => {
          if (id === seq.current) setSimulando(false);
        });
    }, 250);
    return () => window.clearTimeout(t);
  }, [idVariante, tipo, cant, cantValida]);

  if (idVariante === null) {
    if (onSeleccionarVariante) return <BuscadorVariante onSeleccionar={onSeleccionarVariante} />;
    return (
      <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
        <h2 className="text-sm font-extrabold uppercase tracking-ancho text-apagado">Registrar movimiento</h2>
        <p className="mt-3 text-sm text-apagado">
          Elige una variante en la tabla para registrar su entrada o ajuste.
        </p>
      </section>
    );
  }

  const motivoValido = motivo.trim().length >= 3;
  const permitido = sim?.Permitido ?? false;
  const esEntrada = tipo === 'ENTRADA_COMPRA';
  const puedeRegistrar = cantValida && motivoValido && permitido && !simulando && !registrar.isPending;

  const enviar = () => {
    if (!puedeRegistrar) return;
    const base = { idVariante, cantidad: cant, motivo: motivo.trim() };
    const payload = esEntrada ? base : { ...base, tipo: tipo as 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' };
    registrar.mutate(payload, {
      onSuccess: () => {
        setCantidad('');
        setMotivo('');
        setSim(null);
      },
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase tracking-ancho text-apagado">Registrar movimiento</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar panel" className="grid h-7 w-7 place-items-center rounded-pill text-apagado hover:bg-fondo-2">
            <IconoCerrar className="h-4 w-4" />
          </button>
        </div>

        {resumen && (
          <div className="mb-4 rounded-12 bg-fondo-2 p-3">
            <p className="font-bold text-marino-900">{resumen.Producto}</p>
            <p className="font-mono text-xs text-apagado">{resumen.SKU}</p>
            <p className="mt-1 text-xs text-apagado">
              Existencia <strong className="text-marino-900">{resumen.Existencia}</strong> · Disponible{' '}
              <strong className="text-marino-900">{resumen.Disponible}</strong>
            </p>
          </div>
        )}

        {/* Chips de tipo */}
        <div className="mb-3 flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.tipo}
              type="button"
              onClick={() => setTipo(t.tipo)}
              className={clsx(
                'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                tipo === t.tipo ? 'bg-marino-700 text-white' : 'bg-fondo-2 text-apagado hover:text-marino-700',
              )}
            >
              {t.texto}
            </button>
          ))}
        </div>

        {/* Cantidad */}
        <label className="mb-1 block text-sm font-semibold text-texto">Cantidad</label>
        <input
          type="number"
          min={1}
          max={100000}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-full rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600"
        />

        {/* Resultado simulado */}
        <div className="mt-2 min-h-[1.5rem] text-sm" data-testid="sim-resultado">
          {simulando && <span className="text-apagado">Calculando…</span>}
          {!simulando && sim && (
            <span className={permitido ? 'font-bold text-exito-texto' : 'font-semibold text-error-texto'}>
              {sim.ExistenciaActual} → {sim.ExistenciaResultante}
              {!permitido && sim.Motivo && <span className="ml-1 font-normal"> · {sim.Motivo}</span>}
            </span>
          )}
        </div>

        {/* Referencia / motivo (obligatorio: el endpoint exige 3-300 caracteres) */}
        <label className="mb-1 mt-3 block text-sm font-semibold text-texto">Referencia / motivo</label>
        <textarea
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={esEntrada ? 'N.º de factura, proveedor…' : 'Motivo del ajuste…'}
          className="w-full rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600"
        />

        <p className="mt-2 rounded-12 bg-fondo-2 px-3 py-2 text-[11px] text-apagado">
          Un ajuste negativo no puede dejar el disponible por debajo de 0. SALIDA_VENTA, DEVOLUCION y
          CANCELACION las registra el sistema.
        </p>

        <Boton className="mt-3 w-full" disabled={!puedeRegistrar} cargando={registrar.isPending} onClick={enviar}>
          {esEntrada ? 'Registrar entrada' : 'Registrar ajuste'}
        </Boton>
      </div>

      {/* Kardex */}
      <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-ancho text-apagado">Kardex · {resumen?.SKU ?? ''}</h3>
          {(kardex?.total ?? 0) > 5 && (
            <button type="button" onClick={() => setVerTodo(true)} className="text-xs font-semibold text-marino-700 hover:underline">
              Ver todo
            </button>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-borde">
          {(kardex?.filas ?? []).map((k) => (
            <FilaKardex key={k.IDKardex} k={k} />
          ))}
          {(kardex?.total ?? 0) === 0 && <li className="py-3 text-center text-sm text-apagado">Sin movimientos.</li>}
        </ul>
        <p className="mt-3 border-t border-borde pt-2 text-[11px] text-apagado">
          Existencia = Σ kardex (invariante verificable con Verificar consistencia).
        </p>
      </div>

      {verTodo && <KardexModal idVariante={idVariante} onCerrar={() => setVerTodo(false)} />}
    </section>
  );
}
