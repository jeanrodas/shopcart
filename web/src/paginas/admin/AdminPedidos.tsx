import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { usePedidosOperacion, useResumenOperacion, usePedidoOperacion } from '../../lib/consultas';
import { useOperacionVivo } from '../../lib/useEventosVivo';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { useOrdenURL, ThOrden } from '../../componentes/ui/Orden';
import { EtiquetaEstadoPedido } from '../../componentes/ui/EtiquetaEstadoPedido';
import { Precio, formatearQuetzales } from '../../componentes/ui/Precio';
import { Paginacion, TAMANOS_PAGINA_ADMIN } from '../catalogo/Paginacion';
import { formatearHace, formatearFechaHora } from '../../lib/formato';
import { siguientePaso } from '../../lib/operacion';
import { AccionesPedido } from './AccionesPedido';
import type { FiltrosPedidosOperacion, PedidoOperacionFila, ResumenOperacion } from '../../api/tipos';

/* -------- rango de fechas (por defecto ultimos 7 dias, para la vista "Todos") -------- */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return iso(d);
}
/** Convierte 'YYYY-MM-DD' a limites UTC semiabiertos [desde, hasta+1dia). */
function limites(desde: string, hasta: string): { desde?: string; hasta?: string } {
  const r: { desde?: string; hasta?: string } = {};
  if (desde) r.desde = `${desde}T00:00:00.000Z`;
  if (hasta) {
    const h = new Date(`${hasta}T00:00:00.000Z`);
    h.setUTCDate(h.getUTCDate() + 1);
    r.hasta = h.toISOString();
  }
  return r;
}

interface Tarjeta {
  clave: string;
  titulo: string;
  estado: string; // codigo(s) para el filtro
  clases: string;
  conteo: (r: ResumenOperacion) => number;
  sub?: (r: ResumenOperacion) => string;
}
const TARJETAS: Tarjeta[] = [
  {
    clave: 'PAGADO',
    titulo: 'Pagados',
    estado: 'PAGADO',
    clases: 'bg-degradado-marino text-white',
    conteo: (r) => r.Pagado,
    sub: (r) => `por preparar · el más antiguo ${formatearHace(r.PagadoMasAntiguoMinutos)}`,
  },
  { clave: 'EN_PREPARACION', titulo: 'En preparación', estado: 'EN_PREPARACION', clases: 'bg-white', conteo: (r) => r.EnPreparacion },
  { clave: 'DESPACHADO', titulo: 'Despachados', estado: 'DESPACHADO', clases: 'bg-white', conteo: (r) => r.Despachado },
  {
    clave: 'ENTREGADO',
    titulo: 'Entregados',
    estado: 'ENTREGADO',
    clases: 'bg-white',
    conteo: (r) => r.EntregadoReciente,
    sub: () => 'últimos 7 días',
  },
  {
    clave: 'CANCELADO,DEVUELTO',
    titulo: 'Cancelados / Devueltos',
    estado: 'CANCELADO,DEVUELTO',
    clases: 'bg-white',
    conteo: (r) => r.CanceladosRecientes + r.DevueltosRecientes,
    sub: () => 'últimos 7 días',
  },
];

/** Estados terminales que se acotan a los ultimos 7 dias (por ultima actualizacion), para
 *  que la tabla coincida con el conteo de la tarjeta. El resto muestra todo el estado. */
const ESTADOS_RECIENTES = new Set(['ENTREGADO', 'CANCELADO,DEVUELTO']);

export default function AdminPedidos() {
  const [texto, setTexto] = useState('');
  const [textoDeb, setTextoDeb] = useState('');
  const [desde, setDesde] = useState(hace(7));
  const [hasta, setHasta] = useState(iso(new Date()));
  // Por defecto entra seleccionada la cola de trabajo (Pagados): la tabla muestra todos los
  // PAGADO sin filtro de fecha, y su conteo coincide con la tarjeta.
  const [tarjeta, setTarjeta] = useState<string | null>('PAGADO'); // estado de la tarjeta activa
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState(20);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  // `fecha` DESC (mas recientes primero) es el orden por defecto del listado; las columnas
  // visibles ordenables son numero/total/estado/hace.
  const orden = useOrdenURL(['numero', 'fecha', 'total', 'estado', 'hace'] as const, {
    orden: 'fecha',
    direccion: 'DESC',
  });

  useEffect(() => {
    document.title = 'Pedidos · Operación';
  }, []);

  // Refresco en vivo: un evento SSE (pedido.creado/pedido.estado) o volver el foco invalida
  // claves.operacion.todo, por lo que la tarjeta (resumen) y la tabla (listado) se refrescan
  // JUNTAS y el pedido recién creado aparece sin recargar.
  const estadoVivo = useOperacionVivo();

  useEffect(() => {
    const t = window.setTimeout(() => setTextoDeb(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    setPagina(1);
  }, [textoDeb, desde, hasta, tarjeta, tamanoPagina]);

  const { data: resumen } = useResumenOperacion();

  const filtros: FiltrosPedidosOperacion = useMemo(() => {
    // Con una tarjeta activa, la tabla muestra TODO ese estado (sin rango de fechas). Para los
    // estados terminales "recientes" (Entregados, Cancelados/Devueltos) se acota a 7 dias por
    // ultima actualizacion, el MISMO criterio que el conteo de la tarjeta. "Todos" aplica el rango.
    if (tarjeta) {
      return {
        estado: tarjeta,
        texto: textoDeb || undefined,
        recienteDias: ESTADOS_RECIENTES.has(tarjeta) ? 7 : undefined,
        pagina,
        tamanoPagina,
        orden: orden.orden,
        direccion: orden.direccion,
      };
    }
    return {
      texto: textoDeb || undefined,
      ...limites(desde, hasta),
      pagina,
      tamanoPagina,
      orden: orden.orden,
      direccion: orden.direccion,
    };
  }, [tarjeta, textoDeb, desde, hasta, pagina, tamanoPagina, orden.orden, orden.direccion]);

  const { data, isPending, isError, refetch, isPlaceholderData } = usePedidosOperacion(filtros);

  const clicTarjeta = (estado: string) => {
    setTarjeta((prev) => (prev === estado ? null : estado));
    setSeleccion(null);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Indicador no visible del estado de la suscripción SSE (para pruebas y diagnóstico). */}
      <span data-testid="sse-operacion" data-estado={estadoVivo} className="sr-only" />
      <div className="min-w-0">
        {/* Cabecera */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Operación</p>
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Pedidos</h1>
          {resumen && (
            <p className="mt-1 text-sm text-apagado">
              {resumen.Pagado} por preparar · {resumen.EnPreparacion} por despachar · {resumen.Despachado} en ruta ·{' '}
              últimos 7 días: {resumen.EntregadoReciente} entregados
            </p>
          )}
          {/* "Exportar Excel" se omite: M9 solo exporta ventas/categorias/top-productos, no pedidos. */}
        </div>

        {/* Tarjetas de flujo */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {TARJETAS.map((t) => {
            const activa = tarjeta === t.estado;
            const oscura = t.clases.includes('marino');
            return (
              <button
                key={t.clave}
                type="button"
                onClick={() => clicTarjeta(t.estado)}
                className={clsx(
                  'rounded-20 border p-3 text-left shadow-suave transition-all',
                  t.clases,
                  oscura ? 'border-transparent' : 'border-borde',
                  activa && 'ring-2 ring-ambar ring-offset-1',
                )}
              >
                <p className={clsx('text-xs font-semibold uppercase tracking-ancho', oscura ? 'text-white/60' : 'text-apagado')}>
                  {t.titulo}
                </p>
                <p data-testid={`tarjeta-${t.clave}`} className={clsx('mt-1 text-2xl font-extrabold', oscura ? 'text-white' : 'text-marino-900')}>
                  {resumen ? t.conteo(resumen) : '—'}
                </p>
                {t.sub && resumen && (
                  <p className={clsx('mt-0.5 truncate text-[11px]', oscura ? 'text-white/60' : 'text-apagado')}>{t.sub(resumen)}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="mb-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por número o cliente…"
              className="min-w-0 flex-1 rounded-pill border border-[rgba(15,23,42,.14)] bg-fondo px-4 py-2.5 text-sm outline-none focus:border-marino-600"
            />
            <div className={clsx('flex items-center gap-2 text-sm', tarjeta && 'opacity-50')}>
              <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} disabled={!!tarjeta} className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-2 outline-none focus:border-marino-600" />
              <span className="text-apagado">→</span>
              <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} disabled={!!tarjeta} className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-2 outline-none focus:border-marino-600" />
            </div>
            <button
              type="button"
              onClick={() => { setTarjeta(null); setDesde(hace(7)); setHasta(iso(new Date())); }}
              className={clsx('rounded-pill px-3 py-2 text-xs font-semibold', !tarjeta ? 'bg-marino-600/10 text-marino-700' : 'bg-fondo-2 text-apagado hover:text-marino-700')}
            >
              Todos · últimos 7 días
            </button>
          </div>
          {tarjeta && <p className="mt-2 text-xs text-apagado">Mostrando todos los pedidos del estado seleccionado (sin filtro de fecha).</p>}
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
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                      <ThOrden col="numero" estado={orden} className="px-4 py-3">Pedido</ThOrden>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Productos</th>
                      <ThOrden col="total" estado={orden} className="px-4 py-3">Total</ThOrden>
                      <ThOrden col="estado" estado={orden} className="px-4 py-3">Estado</ThOrden>
                      <ThOrden col="hace" estado={orden} className="px-4 py-3">Hace</ThOrden>
                      <th className="px-4 py-3 text-right">Siguiente paso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.filas.map((p) => (
                      <FilaPedido key={p.IDPedido} p={p} seleccionado={seleccion === p.IDPedido} onSel={() => setSeleccion(p.IDPedido)} />
                    ))}
                    {data.filas.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-apagado">No hay pedidos con estos filtros.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Movil: tarjetas */}
              <div className={clsx('grid grid-cols-1 gap-3 lg:hidden', isPlaceholderData && 'opacity-60')}>
                {data.filas.map((p) => (
                  <TarjetaPedidoMovil key={p.IDPedido} p={p} onSel={() => setSeleccion(p.IDPedido)} />
                ))}
                {data.filas.length === 0 && (
                  <p className="rounded-20 border border-borde bg-white p-6 text-center text-apagado">No hay pedidos con estos filtros.</p>
                )}
              </div>

              {data.total > tamanoPagina && (
                <Paginacion pagina={pagina} tamanoPagina={tamanoPagina} total={data.total} onPagina={setPagina} onTamano={setTamanoPagina} tamanos={TAMANOS_PAGINA_ADMIN} />
              )}
            </>
          )}
        </EstadoVista>
      </div>

      {/* Panel derecho */}
      <aside className="lg:sticky lg:top-24 lg:self-start" data-testid="panel-pedidos">
        {seleccion === null ? (
          <section className="rounded-20 border border-borde bg-white p-5 text-sm text-apagado shadow-suave">
            Selecciona un pedido para ver su detalle y avanzar su estado.
          </section>
        ) : (
          <PanelPedido id={seleccion} onHecho={() => setSeleccion(null)} />
        )}
      </aside>
    </div>
  );
}

function FilaPedido({ p, seleccionado, onSel }: { p: PedidoOperacionFila; seleccionado: boolean; onSel: () => void }) {
  const paso = siguientePaso(p.EstadoCodigo);
  const viejo = p.EstadoCodigo === 'PAGADO' && p.MinutosEnEstado > 120;
  return (
    <tr
      onClick={onSel}
      className={clsx('cursor-pointer border-b border-borde last:border-0 hover:bg-fondo-2', seleccionado && 'border-l-2 border-l-naranja-600 bg-naranja-600/5')}
    >
      <td className="px-4 py-3 font-mono font-semibold text-marino-900">{p.NumeroPedido}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-marino-900">{p.NombreCliente}</p>
        {p.Municipio && <p className="text-xs text-apagado">{p.Municipio}{p.Departamento ? `, ${p.Departamento}` : ''}</p>}
      </td>
      <td className="px-4 py-3 text-texto">{p.CantidadLineas} · {p.CantidadUnidades} u</td>
      <td className="px-4 py-3"><Precio monto={p.Total} className="font-semibold text-marino-900" /></td>
      <td className="px-4 py-3"><EtiquetaEstadoPedido codigo={p.EstadoCodigo} /></td>
      <td className={clsx('px-4 py-3 text-xs', viejo ? 'font-bold text-naranja-700' : 'text-apagado')}>{formatearHace(p.MinutosEnEstado)}</td>
      <td className="px-4 py-3 text-right">
        {paso ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onSel(); }} className="rounded-pill bg-degradado-acento px-3 py-1.5 text-xs font-bold text-marino-900">
            {paso.texto}
          </button>
        ) : p.EstadoCodigo === 'ENTREGADO' ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onSel(); }} className="rounded-pill bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
            Registrar devolución
          </button>
        ) : (
          <span className="text-xs text-apagado">—</span>
        )}
      </td>
    </tr>
  );
}

function TarjetaPedidoMovil({ p, onSel }: { p: PedidoOperacionFila; onSel: () => void }) {
  const viejo = p.EstadoCodigo === 'PAGADO' && p.MinutosEnEstado > 120;
  return (
    <button type="button" onClick={onSel} className="w-full rounded-20 border border-borde bg-white p-4 text-left shadow-suave">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-semibold text-marino-900">{p.NumeroPedido}</span>
        <EtiquetaEstadoPedido codigo={p.EstadoCodigo} />
      </div>
      <p className="mt-1 text-sm font-semibold text-marino-900">{p.NombreCliente}</p>
      {p.Municipio && <p className="text-xs text-apagado">{p.Municipio}{p.Departamento ? `, ${p.Departamento}` : ''}</p>}
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-apagado">{p.CantidadLineas} · {p.CantidadUnidades} u · <span className={viejo ? 'font-bold text-naranja-700' : ''}>{formatearHace(p.MinutosEnEstado)}</span></span>
        <Precio monto={p.Total} className="font-bold text-marino-900" />
      </div>
    </button>
  );
}

function PanelPedido({ id, onHecho }: { id: number; onHecho: () => void }) {
  const { data, isPending, isError, refetch } = usePedidoOperacion(id);
  return (
    <section className="flex flex-col gap-4">
      <EstadoVista cargando={isPending} error={isError} alReintentar={() => void refetch()} esqueleto={<div className="esqueleto h-96 w-full rounded-20" />}>
        {data && (
          <>
            <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-extrabold text-marino-900">{data.pedido.NumeroPedido}</span>
                <EtiquetaEstadoPedido codigo={data.pedido.EstadoCodigo} />
              </div>
              <p className="mt-1 text-xs text-apagado">
                {formatearFechaHora(data.pedido.FechaCreacion)}
                {data.pago && <> · pago {data.pago.MetodoPago} ref. <span className="font-mono">{data.pago.Referencia}</span></>}
              </p>
              <Link to={`/admin/pedidos/${id}`} className="mt-2 inline-block text-sm font-semibold text-marino-700 hover:underline">
                Ver completo ↗
              </Link>

              <div className="mt-3 border-t border-borde pt-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-ancho text-apagado">Cliente</p>
                <p className="font-semibold text-marino-900">{data.pedido.ClienteNombre}</p>
                <p className="text-xs text-apagado">{data.pedido.ClienteCorreo}</p>
                <p className="mt-2 text-xs text-apagado">{data.pedido.DireccionEntrega}</p>
              </div>

              <ul className="mt-3 flex flex-col divide-y divide-borde border-t border-borde pt-1">
                {data.lineas.map((l) => (
                  <li key={l.IDPedidoDetalle} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {l.Cantidad}× {l.NombreProducto} <span className="font-mono text-xs text-apagado">{l.SKU}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-marino-900">{formatearQuetzales(l.TotalLinea)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-borde pt-2">
                <span className="text-sm font-semibold text-marino-900">Total</span>
                <Precio monto={data.pedido.Total} className="text-lg font-extrabold text-marino-900" />
              </div>
            </div>

            <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
              <AccionesPedido pedido={data.pedido} lineas={data.lineas} onHecho={onHecho} />
            </div>
          </>
        )}
      </EstadoVista>
    </section>
  );
}
