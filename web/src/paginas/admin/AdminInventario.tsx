import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import {
  useCategoriasAdmin,
  useInventarioAdmin,
  useResumenInventario,
  useVerificarConsistencia,
} from '../../lib/consultas';
import { Boton } from '../../componentes/ui/Boton';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { Modal } from '../../componentes/ui/Modal';
import { PanelLateral } from '../../componentes/ui/PanelLateral';
import { resolverImagen } from '../../lib/imagenes';
import { formatearMomento } from '../../lib/formato';
import { Paginacion, TAMANOS_PAGINA_ADMIN } from '../catalogo/Paginacion';
import { IconoDevolucion, IconoMas, IconoEscudo, IconoReloj } from '../../componentes/iconos';
import { PanelMovimiento } from './PanelMovimiento';
import type {
  FiltroInventario,
  FiltrosInventario,
  InventarioFila,
  ResultadoConsistencia,
} from '../../api/tipos';

type ClaveChip = FiltroInventario | 'todas';
const CHIPS: { clave: ClaveChip; texto: string; clases: string }[] = [
  { clave: 'todas', texto: 'Todas', clases: 'bg-marino-600/10 text-marino-700' },
  { clave: 'bajoStock', texto: 'Bajo stock', clases: 'bg-ambar/15 text-naranja-700' },
  { clave: 'agotadas', texto: 'Agotadas', clases: 'bg-error/10 text-error-texto' },
  { clave: 'conReservas', texto: 'Con reservas', clases: 'bg-marino-600/10 text-marino-700' },
];

/** Pill del disponible: verde / ambar "N · bajo" / rojo "0 · agotada". */
function PillDisponible({ f }: { f: InventarioFila }) {
  if (f.Disponible <= 0) {
    return <span className="rounded-pill bg-error/10 px-2.5 py-1 text-xs font-semibold text-error-texto">0 · agotada</span>;
  }
  if (f.BajoStock) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-ambar/15 px-2.5 py-1 text-xs font-semibold text-naranja-700">
        <IconoDevolucion className="h-3.5 w-3.5" />
        {f.Disponible} · bajo
      </span>
    );
  }
  return <span className="rounded-pill bg-exito/10 px-2.5 py-1 text-xs font-semibold text-exito-texto">{f.Disponible}</span>;
}

/** Texto del ultimo movimiento: "Hoy 10:42 · SALIDA_VENTA −1". */
function ultimoMovimiento(f: InventarioFila): string {
  if (!f.UltimoMovimientoFecha || !f.UltimoMovimientoTipo) return 'Sin movimientos';
  const signo = (f.UltimoMovimientoSigno ?? 0) < 0 ? '−' : '+';
  return `${formatearMomento(f.UltimoMovimientoFecha)} · ${f.UltimoMovimientoTipo} ${signo}${f.UltimoMovimientoCantidad ?? ''}`;
}

export default function AdminInventario() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'Administrador';

  const [params, setParams] = useSearchParams();
  const [texto, setTexto] = useState('');
  const [textoDeb, setTextoDeb] = useState('');
  const [idCategoria, setIdCategoria] = useState<number | ''>('');
  const [idProducto, setIdProducto] = useState<number | null>(null);
  const [chip, setChip] = useState<ClaveChip>('todas');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);

  // Variante seleccionada para el panel (IDVariante); el panel lee su detalle del kardex.
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [panelTipo, setPanelTipo] = useState<'ENTRADA_COMPRA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO'>('ENTRADA_COMPRA');
  const [panelAbierto, setPanelAbierto] = useState(false);

  const [modalCons, setModalCons] = useState(false);
  const consulta = useVerificarConsistencia();
  const [resCons, setResCons] = useState<ResultadoConsistencia | null>(null);

  useEffect(() => {
    document.title = 'Inventario · Operación';
  }, []);

  // Deep links iniciales: ?variante=<id> preselecciona la variante y abre el panel;
  // ?producto=<id> acota el listado a ese producto (boton "Inventario" de /admin/productos).
  useEffect(() => {
    const v = params.get('variante');
    if (v && Number(v) > 0) {
      setSeleccion(Number(v));
      setPanelAbierto(true);
    }
    const p = params.get('producto');
    if (p && Number(p) > 0) setIdProducto(Number(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setTextoDeb(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [textoDeb, idCategoria, idProducto, chip, tamano]);

  const filtros: FiltrosInventario = useMemo(
    () => ({
      texto: textoDeb || undefined,
      idCategoria: idCategoria === '' ? undefined : idCategoria,
      idProducto: idProducto ?? undefined,
      filtro: chip === 'todas' ? undefined : chip,
      pagina,
      tamano,
    }),
    [textoDeb, idCategoria, idProducto, chip, pagina, tamano],
  );

  const { data, isPending, isError, refetch, isPlaceholderData } = useInventarioAdmin(filtros);
  const { data: resumen } = useResumenInventario();
  const { data: categorias } = useCategoriasAdmin();
  const r = resumen?.resumen ?? null;

  const conteoChip: Record<ClaveChip, number | null> = {
    todas: r?.TotalVariantes ?? null,
    bajoStock: r?.VariantesBajoStock ?? null,
    agotadas: r?.VariantesAgotadas ?? null,
    conReservas: r?.VariantesConReservas ?? null,
  };

  const seleccionar = (
    id: number,
    tipo: 'ENTRADA_COMPRA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' = 'ENTRADA_COMPRA',
  ) => {
    setSeleccion(id);
    setPanelTipo(tipo);
    setPanelAbierto(true);
  };

  // Cierra el panel deslizante y limpia la preselección por URL (?variante).
  const cerrarPanel = () => {
    setPanelAbierto(false);
    setSeleccion(null);
    if (params.has('variante')) {
      setParams((p) => {
        p.delete('variante');
        return p;
      });
    }
  };

  // Quita el filtro por producto y su parámetro de URL.
  const quitarProducto = () => {
    setIdProducto(null);
    if (params.has('producto')) {
      setParams((p) => {
        p.delete('producto');
        return p;
      });
    }
  };

  const verificar = () => {
    setModalCons(true);
    consulta.mutate(undefined, { onSuccess: (res) => setResCons(res) });
  };

  const inconsistencias = r?.Inconsistencias ?? 0;

  return (
    <div className="min-w-0">
        {/* Cabecera */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Operación</p>
            <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Inventario</h1>
            {r && (
              <p className="mt-1 text-sm text-apagado">
                {r.TotalVariantes} variantes · {r.VariantesBajoStock} bajo stock · {r.VariantesAgotadas} agotadas ·{' '}
                <span className={inconsistencias === 0 ? 'font-semibold text-exito-texto' : 'font-semibold text-error-texto'}>
                  consistencia kardex: {inconsistencias} {inconsistencias === 1 ? 'inconsistencia' : 'inconsistencias'}
                </span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {esAdmin && (
              <Boton variante="fantasma" onClick={verificar}>
                <IconoEscudo className="h-4 w-4" /> Verificar consistencia
              </Boton>
            )}
            <Boton
              onClick={() => {
                setSeleccion(null);
                setPanelAbierto(true);
              }}
            >
              <IconoMas className="h-4 w-4" /> Registrar movimiento
            </Boton>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-20 bg-degradado-marino p-4 text-white shadow-marino">
            <p className="text-xs font-semibold uppercase tracking-ancho text-white/60">Unidades disponibles</p>
            <p className="mt-1 text-3xl font-extrabold">{r?.UnidadesDisponibles ?? '—'}</p>
            <p className="mt-0.5 text-xs text-white/60">existencia − reservas activas</p>
          </div>
          <div className="rounded-20 border border-borde bg-white p-4 shadow-suave">
            <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Reservadas ahora</p>
            <p className="mt-1 text-3xl font-extrabold text-marino-900">{r?.UnidadesReservadas ?? '—'}</p>
            <p className="mt-0.5 text-xs text-apagado">vencen en ≤ {r?.ReservaMinutos ?? 15} min</p>
          </div>
          <div className="rounded-20 border border-ambar/40 bg-ambar/10 p-4 shadow-suave">
            <p className="text-xs font-semibold uppercase tracking-ancho text-naranja-700">Bajo stock</p>
            <p className="mt-1 text-3xl font-extrabold text-naranja-700">{r?.VariantesBajoStock ?? '—'}</p>
            <p className="mt-0.5 text-xs text-naranja-700/80">umbral STOCK_MINIMO = {r?.UmbralBajoStock ?? 5}</p>
          </div>
          <div className="rounded-20 border border-borde bg-white p-4 shadow-suave">
            <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Movimientos hoy</p>
            <p className="mt-1 text-3xl font-extrabold text-marino-900">{r?.MovimientosHoy ?? '—'}</p>
            <p className="mt-0.5 truncate text-xs text-apagado">
              {(resumen?.movimientosHoy ?? []).length
                ? resumen!.movimientosHoy.map((m) => `${m.NombreTipo}: ${m.Cantidad}`).join(' · ')
                : 'sin movimientos hoy'}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por SKU o producto…"
              className="min-w-0 flex-1 rounded-pill border border-[rgba(15,23,42,.14)] bg-fondo px-4 py-2.5 text-sm outline-none focus:border-marino-600"
            />
            <select
              value={idCategoria}
              onChange={(e) => setIdCategoria(e.target.value ? Number(e.target.value) : '')}
              className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-4 py-2.5 text-sm outline-none focus:border-marino-600"
            >
              <option value="">Todas las categorías</option>
              {categorias?.map((c) => (
                <option key={c.IDCategoria} value={c.IDCategoria}>
                  {c.Nombre}
                  {!c.Activo ? ' (inactiva)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHIPS.map((ch) => {
              const n = conteoChip[ch.clave];
              const activo = chip === ch.clave;
              return (
                <button
                  key={ch.clave}
                  type="button"
                  onClick={() => setChip(ch.clave)}
                  className={clsx(
                    'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                    activo ? ch.clases : 'bg-fondo-2 text-apagado hover:text-marino-700',
                  )}
                >
                  {ch.texto}
                  {n !== null && <span className="ml-1 opacity-70">{n}</span>}
                </button>
              );
            })}
          </div>
          {idProducto && (
            <div className="mt-3">
              <button
                type="button"
                onClick={quitarProducto}
                className="inline-flex items-center gap-1.5 rounded-pill bg-marino-600/10 px-3 py-1.5 text-xs font-semibold text-marino-700 hover:bg-marino-600/20"
              >
                Producto: {data?.filas[0]?.Producto ?? `#${idProducto}`}
                <span aria-hidden="true" className="text-sm leading-none">×</span>
                <span className="sr-only">Quitar filtro de producto</span>
              </button>
            </div>
          )}
        </div>

        <EstadoVista
          cargando={isPending}
          error={isError}
          alReintentar={() => void refetch()}
          esqueleto={<div className="esqueleto h-80 w-full rounded-20" />}
        >
          {data && (
            <>
              {/* Escritorio: tabla */}
              <div className={clsx('hidden overflow-x-auto rounded-20 border border-borde bg-white shadow-suave lg:block', isPlaceholderData && 'opacity-60')}>
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                      <th className="px-4 py-3">Variante</th>
                      <th className="px-4 py-3">Existencia</th>
                      <th className="px-4 py-3">Reservado</th>
                      <th className="px-4 py-3">Disponible</th>
                      <th className="px-4 py-3">Último movimiento</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.filas.map((f) => (
                      <FilaInv key={f.IDVariante} f={f} seleccionada={seleccion === f.IDVariante} onSel={seleccionar} />
                    ))}
                    {data.filas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-apagado">
                          No hay variantes con estos filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Movil: tarjetas */}
              <div className={clsx('grid grid-cols-1 gap-3 lg:hidden', isPlaceholderData && 'opacity-60')}>
                {data.filas.map((f) => (
                  <TarjetaInv key={f.IDVariante} f={f} onSel={seleccionar} />
                ))}
                {data.filas.length === 0 && (
                  <p className="rounded-20 border border-borde bg-white p-6 text-center text-apagado">
                    No hay variantes con estos filtros.
                  </p>
                )}
              </div>

              {data.total > tamano && (
                <Paginacion pagina={pagina} tamanoPagina={tamano} total={data.total} onPagina={setPagina} onTamano={setTamano} tamanos={TAMANOS_PAGINA_ADMIN} />
              )}
            </>
          )}
        </EstadoVista>

      {/* Panel deslizante compartido (PanelLateral): 560px en escritorio, pantalla completa en
          movil. Se abre al pulsar Entrada/Ajuste/Kardex en una fila, "+ Registrar movimiento"
          (con buscador de variante) o al llegar con ?variante=<id>. */}
      <PanelLateral abierto={panelAbierto} onCerrar={cerrarPanel} etiqueta="Registrar movimiento" testid="panel-inventario">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <PanelMovimiento
            idVariante={seleccion}
            tipoInicial={panelTipo}
            onCerrar={cerrarPanel}
            onSeleccionarVariante={(id) => {
              setSeleccion(id);
              setPanelTipo('ENTRADA_COMPRA');
            }}
          />
        </div>
      </PanelLateral>

      {/* Modal de consistencia (solo Administrador) */}
      <Modal
        abierto={modalCons}
        titulo="Consistencia del kardex"
        icono={<IconoEscudo className="h-6 w-6 text-marino-600" />}
        textoConfirmar="Cerrar"
        textoCancelar="Cerrar"
        varianteConfirmar="primario"
        alConfirmar={() => setModalCons(false)}
        alCancelar={() => setModalCons(false)}
      >
        {consulta.isPending ? (
          <p>Verificando el invariante Existencia = Σ kardex…</p>
        ) : resCons && resCons.consistente ? (
          <p className="font-semibold text-exito-texto">Existencia = Σ kardex en todas las variantes ({resCons.totalVariantes}).</p>
        ) : resCons ? (
          <div>
            <p className="mb-2 font-semibold text-error-texto">
              {resCons.variantesInconsistentes} variante(s) con diferencia:
            </p>
            <ul className="flex flex-col gap-1">
              {resCons.inconsistencias.map((i) => (
                <li key={i.IDVariante} className="flex justify-between font-mono text-xs">
                  <span>{i.SKU}</span>
                  <span>existencia {i.Existencia} · kardex {i.SumaKardex} · Δ {i.Diferencia}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-error-texto">No se pudo verificar.</p>
        )}
      </Modal>
    </div>
  );
}

function FilaInv({
  f,
  seleccionada,
  onSel,
}: {
  f: InventarioFila;
  seleccionada: boolean;
  onSel: (id: number, tipo: 'ENTRADA_COMPRA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO') => void;
}) {
  const agotada = f.Disponible <= 0;
  return (
    <tr
      className={clsx(
        'border-b border-borde last:border-0',
        seleccionada && 'border-l-2 border-l-marino-600 bg-marino-600/5',
        !seleccionada && agotada && 'bg-error/5',
        !seleccionada && !agotada && f.BajoStock && 'bg-ambar/10',
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={resolverImagen(f.ImagenPrincipal)} alt="" className="h-[42px] w-[42px] shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover" />
          <div className="min-w-0">
            <p className="font-bold text-marino-900">
              {f.Producto}
              {!f.Activo && <span className="ml-1 text-xs font-normal text-apagado">(inactiva)</span>}
            </p>
            <p className="truncate text-xs text-apagado">
              {f.Presentacion ? `${f.Presentacion} · ` : ''}
              <span className="font-mono">{f.SKU}</span>
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-texto">{f.Existencia}</td>
      <td className="px-4 py-3 text-texto">{f.Reservado}</td>
      <td className="px-4 py-3"><PillDisponible f={f} /></td>
      <td className="px-4 py-3 text-xs text-apagado">{ultimoMovimiento(f)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onSel(f.IDVariante, 'ENTRADA_COMPRA')}
            className={clsx('rounded-pill px-3 py-1.5', agotada ? 'bg-degradado-acento text-marino-900' : 'bg-marino-600/10 text-marino-700 hover:bg-marino-600/20')}
          >
            Entrada
          </button>
          <button type="button" onClick={() => onSel(f.IDVariante, 'AJUSTE_POSITIVO')} className="rounded-pill bg-fondo-2 px-3 py-1.5 text-apagado hover:text-marino-700">
            Ajuste
          </button>
          <button
            type="button"
            onClick={() => onSel(f.IDVariante, 'ENTRADA_COMPRA')}
            aria-label="Ver kardex"
            title="Ver kardex"
            className="grid h-8 w-8 place-items-center rounded-pill bg-fondo-2 text-apagado hover:text-marino-700"
          >
            <IconoReloj className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TarjetaInv({
  f,
  onSel,
}: {
  f: InventarioFila;
  onSel: (id: number, tipo: 'ENTRADA_COMPRA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO') => void;
}) {
  const agotada = f.Disponible <= 0;
  return (
    <article className={clsx('rounded-20 border border-borde bg-white p-4 shadow-suave', agotada && 'border-error/30', !agotada && f.BajoStock && 'border-ambar/40')}>
      <div className="flex gap-3">
        <img src={resolverImagen(f.ImagenPrincipal)} alt="" className="h-14 w-14 shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-marino-900">{f.Producto}</p>
          <p className="truncate text-xs text-apagado">
            {f.Presentacion ? `${f.Presentacion} · ` : ''}
            <span className="font-mono">{f.SKU}</span>
          </p>
          <p className="mt-1 text-xs text-apagado">{ultimoMovimiento(f)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-apagado">Existencia {f.Existencia} · Reservado {f.Reservado}</span>
        <span className="ml-auto"><PillDisponible f={f} /></span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onSel(f.IDVariante, 'ENTRADA_COMPRA')} className={clsx('rounded-pill px-4 py-2 text-sm font-semibold', agotada ? 'bg-degradado-acento text-marino-900' : 'bg-marino-600/10 text-marino-700')}>
          Entrada
        </button>
        <button type="button" onClick={() => onSel(f.IDVariante, 'AJUSTE_POSITIVO')} className="rounded-pill border border-borde px-4 py-2 text-sm font-semibold text-apagado">
          Ajuste / Kardex
        </button>
      </div>
    </article>
  );
}
