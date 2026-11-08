import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useBitacora } from '../../lib/consultas';
import { listarEventosRegistro } from '../../api/bitacora';
import { useQuery } from '@tanstack/react-query';
import { claves } from '../../lib/claves';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { useOrdenURL, ThOrden } from '../../componentes/ui/Orden';
import { PanelLateral } from '../../componentes/ui/PanelLateral';
import { Paginacion, TAMANOS_PAGINA_ADMIN } from '../catalogo/Paginacion';
import { formatearMomento, formatearFechaHora } from '../../lib/formato';
import type { AccionBitacora, BitacoraEvento, FiltrosBitacora } from '../../api/tipos';

/** Entidades auditadas por los triggers de 019 (fijas). Son el filtro "tabla". */
const ENTIDADES = ['Producto', 'Variante', 'Kardex', 'Cupon', 'Pedido'];
const ACCIONES: AccionBitacora[] = ['CREAR', 'MODIFICAR', 'DESACTIVAR'];

const PILL_ACCION: Record<AccionBitacora, string> = {
  CREAR: 'bg-exito/10 text-exito-texto',
  MODIFICAR: 'bg-ambar/15 text-naranja-700',
  DESACTIVAR: 'bg-error/10 text-error-texto',
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return iso(d);
}

/** Parsea el JSON de la bitacora. Para PEDIDOS el valor es un codigo plano (no JSON). */
function parse(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v: unknown = JSON.parse(s);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : { valor: v };
  } catch {
    return { valor: s };
  }
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

interface Cambio {
  campo: string;
  antes?: unknown;
  despues?: unknown;
}

/** Diferencia de presentacion entre ValorAnterior y ValorNuevo (no es logica de negocio). */
function diff(ev: BitacoraEvento): Cambio[] {
  const a = parse(ev.ValorAnterior);
  const d = parse(ev.ValorNuevo);
  if (ev.Accion === 'CREAR') {
    return Object.entries(d ?? {}).slice(0, 3).map(([campo, despues]) => ({ campo, despues }));
  }
  const campos = new Set([...Object.keys(a ?? {}), ...Object.keys(d ?? {})]);
  const out: Cambio[] = [];
  for (const campo of campos) {
    if (JSON.stringify(a?.[campo]) !== JSON.stringify(d?.[campo])) {
      out.push({ campo, antes: a?.[campo], despues: d?.[campo] });
    }
  }
  return out;
}

export default function AdminBitacora() {
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState<'' | AccionBitacora>('');
  const [desde, setDesde] = useState(hace(7));
  const [hasta, setHasta] = useState(iso(new Date()));
  const [texto, setTexto] = useState('');
  const [textoDeb, setTextoDeb] = useState('');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  const [sel, setSel] = useState<BitacoraEvento | null>(null);
  const orden = useOrdenURL(['fecha'] as const, { orden: 'fecha', direccion: 'DESC' });

  useEffect(() => {
    document.title = 'Bitácora · Control';
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setTextoDeb(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [entidad, accion, desde, hasta, textoDeb, tamano]);

  const filtros: FiltrosBitacora = useMemo(
    () => ({
      entidad: entidad || undefined,
      accion: accion || undefined,
      // Sin milisegundos: la BD guarda DATETIME2(0) y .999 redondearia fuera de rango.
      desde: desde ? `${desde}T00:00:00Z` : undefined,
      hasta: hasta ? `${hasta}T23:59:59Z` : undefined,
      texto: textoDeb || undefined,
      pagina,
      tamano,
      orden: orden.orden,
      direccion: orden.direccion,
    }),
    [entidad, accion, desde, hasta, textoDeb, pagina, tamano, orden.orden, orden.direccion],
  );

  const { data, isPending, isError, refetch, isPlaceholderData } = useBitacora(filtros);

  return (
    <div className="min-w-0">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Control</p>
        <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Bitácora</h1>
        <p className="mt-1 text-sm text-apagado">
          Registro inmutable de cambios: {data?.total ?? '—'} eventos · {desde} → {hasta} · solo lectura
        </p>
        {/* Sin exportar: M9 no cubre exportar la bitacora. */}
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-4 py-2.5 text-sm outline-none focus:border-marino-600">
            <option value="">Todas las tablas</option>
            {ENTIDADES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select value={accion} onChange={(e) => setAccion(e.target.value as '' | AccionBitacora)} className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-4 py-2.5 text-sm outline-none focus:border-marino-600">
            <option value="">Todas las acciones</option>
            {ACCIONES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar en los cambios…" className="rounded-pill border border-[rgba(15,23,42,.14)] bg-fondo px-4 py-2.5 text-sm outline-none focus:border-marino-600" />
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className="min-w-0 flex-1 rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-2 outline-none focus:border-marino-600" />
            <span className="text-apagado">→</span>
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="min-w-0 flex-1 rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-2 outline-none focus:border-marino-600" />
          </div>
        </div>
      </div>

      <EstadoVista cargando={isPending} error={isError} alReintentar={() => void refetch()} esqueleto={<div className="esqueleto h-80 w-full rounded-20" />}>
        {data && (
          <>
            {/* Escritorio: tabla */}
            <div className={clsx('hidden overflow-hidden rounded-20 border border-borde bg-white shadow-suave lg:block', isPlaceholderData && 'opacity-60')}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                    <ThOrden col="fecha" estado={orden} className="px-4 py-3">Cuándo</ThOrden>
                    <th className="px-4 py-3">Tabla · registro</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Resumen del cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((ev) => (
                    <FilaEvento key={ev.IDBitacora} ev={ev} onSel={() => setSel(ev)} />
                  ))}
                  {data.filas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-apagado">No hay eventos con estos filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Móvil: tarjetas */}
            <div className={clsx('grid grid-cols-1 gap-3 lg:hidden', isPlaceholderData && 'opacity-60')}>
              {data.filas.map((ev) => (
                <TarjetaEvento key={ev.IDBitacora} ev={ev} onSel={() => setSel(ev)} />
              ))}
              {data.filas.length === 0 && (
                <p className="rounded-20 border border-borde bg-white p-6 text-center text-apagado">No hay eventos con estos filtros.</p>
              )}
            </div>

            {data.total > tamano && (
              <Paginacion pagina={pagina} tamanoPagina={tamano} total={data.total} onPagina={setPagina} onTamano={setTamano} tamanos={TAMANOS_PAGINA_ADMIN} />
            )}
          </>
        )}
      </EstadoVista>

      <PanelLateral abierto={sel !== null} onCerrar={() => setSel(null)} etiqueta="Detalle del evento" testid="panel-bitacora">
        {sel && <DetalleEvento ev={sel} onCerrar={() => setSel(null)} />}
      </PanelLateral>
    </div>
  );
}

function ResumenCambio({ ev }: { ev: BitacoraEvento }) {
  const cambios = diff(ev);
  if (cambios.length === 0) return <span className="text-apagado">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {cambios.slice(0, 3).map((c) => (
        <span key={c.campo}>
          <span className="font-semibold text-marino-900">{c.campo}:</span>{' '}
          {ev.Accion === 'CREAR' ? (
            <span className="text-apagado">{fmtVal(c.despues)}</span>
          ) : (
            <>
              <span className="text-error-texto line-through">{fmtVal(c.antes)}</span>
              <span className="text-apagado"> → </span>
              <span className="text-exito-texto">{fmtVal(c.despues)}</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}

function FilaEvento({ ev, onSel }: { ev: BitacoraEvento; onSel: () => void }) {
  return (
    <tr onClick={onSel} className="cursor-pointer border-b border-borde last:border-0 hover:bg-fondo-2">
      <td className="px-4 py-3 text-xs text-apagado">{formatearMomento(ev.Fecha)}</td>
      <td className="px-4 py-3">
        <span className="font-semibold text-marino-900">{ev.Entidad}</span>{' '}
        <span className="font-mono text-xs text-apagado">#{ev.IDEntidad}</span>
      </td>
      <td className="px-4 py-3">
        <span className={clsx('rounded-pill px-2.5 py-1 text-xs font-semibold', PILL_ACCION[ev.Accion])}>{ev.Accion}</span>
      </td>
      <td className="px-4 py-3 text-xs text-texto">{ev.UsuarioCorreo ?? 'sistema'}</td>
      <td className="px-4 py-3"><ResumenCambio ev={ev} /></td>
    </tr>
  );
}

function TarjetaEvento({ ev, onSel }: { ev: BitacoraEvento; onSel: () => void }) {
  return (
    <button type="button" onClick={onSel} className="w-full rounded-20 border border-borde bg-white p-4 text-left shadow-suave">
      <div className="flex items-center justify-between gap-2">
        <span>
          <span className="font-semibold text-marino-900">{ev.Entidad}</span>{' '}
          <span className="font-mono text-xs text-apagado">#{ev.IDEntidad}</span>
        </span>
        <span className={clsx('rounded-pill px-2.5 py-1 text-xs font-semibold', PILL_ACCION[ev.Accion])}>{ev.Accion}</span>
      </div>
      <p className="mt-1 text-xs text-apagado">{formatearMomento(ev.Fecha)} · {ev.UsuarioCorreo ?? 'sistema'}</p>
      <div className="mt-2"><ResumenCambio ev={ev} /></div>
    </button>
  );
}

/* ------------------------------- Detalle ---------------------------------- */

function BloqueJson({ titulo, datos, cambiadas, color }: { titulo: string; datos: Record<string, unknown> | null; cambiadas: Set<string>; color: 'error' | 'exito' }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-xs font-bold uppercase tracking-ancho text-apagado">{titulo}</p>
      <div className="overflow-x-auto rounded-12 bg-marino-900 p-3 font-mono text-xs text-white/80">
        {datos === null ? (
          <span className="text-white/40">∅</span>
        ) : (
          Object.entries(datos).map(([k, v]) => (
            <div key={k} className={clsx('whitespace-pre-wrap break-words', cambiadas.has(k) && (color === 'error' ? 'text-red-300' : 'text-emerald-300'))}>
              <span className="text-white/50">{k}:</span> {fmtVal(v)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetalleEvento({ ev, onCerrar }: { ev: BitacoraEvento; onCerrar: () => void }) {
  const [verTodos, setVerTodos] = useState(false);
  const a = parse(ev.ValorAnterior);
  const d = parse(ev.ValorNuevo);
  const cambiadas = new Set(diff(ev).map((c) => c.campo));

  const historial = useQuery({
    queryKey: claves.bitacora.registro(ev.Entidad, ev.IDEntidad),
    queryFn: () => listarEventosRegistro(ev.Entidad, ev.IDEntidad),
    enabled: verTodos,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-borde p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">
            Evento #{ev.IDBitacora}
          </h2>
          <p className="text-sm text-apagado">
            {ev.Entidad} <span className="font-mono">#{ev.IDEntidad}</span> ·{' '}
            <span className={clsx('rounded-pill px-2 py-0.5 text-xs font-semibold', PILL_ACCION[ev.Accion])}>{ev.Accion}</span>
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="text-sm font-semibold text-apagado hover:text-marino-700">Cerrar</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-3 text-sm">
          <p className="text-apagado">{formatearFechaHora(ev.Fecha)}</p>
          <p className="mt-1 font-semibold text-marino-900">{ev.UsuarioNombre ?? 'sistema'}</p>
          {ev.UsuarioCorreo && <p className="text-xs text-apagado">{ev.UsuarioCorreo}</p>}
          <p className="mt-1 font-mono text-xs text-apagado">SESSION_CONTEXT('IDUsuario') = {ev.IDUsuario ?? 'NULL'}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {ev.Accion !== 'CREAR' && <BloqueJson titulo="Antes" datos={a} cambiadas={cambiadas} color="error" />}
          <BloqueJson titulo="Después" datos={d} cambiadas={cambiadas} color="exito" />
        </div>

        <p className="mt-3 rounded-12 bg-fondo-2 px-3 py-2 text-xs text-apagado">
          La bitácora es inmutable (DENY + trigger INSTEAD OF): no hay acciones de edición ni borrado.
        </p>

        <button type="button" onClick={() => setVerTodos((v) => !v)} className="mt-3 text-sm font-semibold text-marino-700 hover:underline">
          {verTodos ? 'Ocultar eventos' : `Ver todos los eventos de ${ev.Entidad} #${ev.IDEntidad}`}
        </button>

        {verTodos && (
          <div className="mt-2 flex flex-col gap-1.5">
            {historial.isPending && <p className="text-sm text-apagado">Cargando…</p>}
            {historial.data?.filas.map((e) => (
              <div key={e.IDBitacora} className="flex items-center justify-between gap-2 rounded-12 border border-borde px-3 py-2 text-xs">
                <span className={clsx('rounded-pill px-2 py-0.5 font-semibold', PILL_ACCION[e.Accion])}>{e.Accion}</span>
                <span className="flex-1 truncate text-apagado">{formatearFechaHora(e.Fecha)}</span>
                <span className="text-apagado">{e.UsuarioCorreo ?? 'sistema'}</span>
              </div>
            ))}
            {historial.data && historial.data.filas.length === 0 && <p className="text-sm text-apagado">Sin eventos.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
