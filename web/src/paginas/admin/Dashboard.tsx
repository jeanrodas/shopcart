import { useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  useCategoriasDashboard,
  useCuponesDashboard,
  useDashboardResumen,
  useEmbudo,
  useHorasPico,
  useTopProductosDashboard,
  useVentasPorDia,
} from '../../lib/consultas';
import { useEventosVivo } from '../../lib/useEventosVivo';
import { descargarExcelReporte } from '../../api/dashboard';
import { ErrorApi } from '../../api/clienteHttp';
import { useToast } from '../../componentes/ui/Toast';
import { Boton } from '../../componentes/ui/Boton';
import { formatearQuetzales } from '../../componentes/ui/Precio';
import { formatearFechaLarga, plural } from '../../lib/formato';
import { GraficaVentas, BarrasCategoria, Embudo, MapaCalor, Sparkline, PALETA } from './dashboard/graficas';
import { FeedVivo } from './dashboard/FeedVivo';
import type { RangoDashboard } from '../../api/tipos';

/* ------------------------------ Periodo ----------------------------------- */

type Preset = 'hoy' | '7d' | '30d' | 'mes' | 'personalizado';
const PRESETS: { clave: Preset; texto: string }[] = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: '7d', texto: '7 días' },
  { clave: '30d', texto: '30 días' },
  { clave: 'mes', texto: 'Mes actual' },
  { clave: 'personalizado', texto: 'Personalizado' },
];

function inicioDiaUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Calcula el rango (congelado al seleccionar, no por render) para un preset. */
function rangoDe(preset: Exclude<Preset, 'personalizado'>): RangoDashboard {
  const ahora = new Date();
  const hasta = ahora.toISOString();
  if (preset === 'hoy') return { desde: inicioDiaUTC(ahora).toISOString(), hasta };
  if (preset === '7d') return { desde: inicioDiaUTC(new Date(ahora.getTime() - 6 * 864e5)).toISOString(), hasta };
  if (preset === '30d') return { desde: inicioDiaUTC(new Date(ahora.getTime() - 29 * 864e5)).toISOString(), hasta };
  // mes actual
  return { desde: new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString(), hasta };
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------ Bloque base -------------------------------- */

function Bloque({
  titulo,
  subtitulo,
  accion,
  cargando,
  error,
  onReintentar,
  altoEsqueleto = 'h-56',
  children,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
  cargando: boolean;
  error: boolean;
  onReintentar: () => void;
  altoEsqueleto?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-20 border border-borde bg-white p-4 shadow-suave">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold tracking-apretado text-marino-900">{titulo}</h2>
          {subtitulo && <p className="text-xs text-apagado">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      {cargando ? (
        <div className={clsx('esqueleto w-full rounded-16', altoEsqueleto)} />
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-apagado">No se pudo cargar este bloque.</p>
          <Boton variante="fantasma" onClick={onReintentar}>
            Reintentar
          </Boton>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/* -------------------------------- KPI card --------------------------------- */

function Variacion({ pct, invertido }: { pct: number | null; invertido?: boolean }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs opacity-70">sin comparativo</span>;
  }
  const sube = pct >= 0;
  // "invertido" (p. ej. pagos rechazados): subir es malo (rojo).
  const bueno = invertido ? !sube : sube;
  return (
    <span className={clsx('text-xs font-bold', bueno ? 'text-exito-texto' : 'text-error-texto')}>
      {sube ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({
  titulo,
  valor,
  pct,
  serie,
  colorSpark,
  oscuro,
}: {
  titulo: string;
  valor: string;
  pct: number | null;
  serie: number[];
  colorSpark: string;
  oscuro?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-1 rounded-20 p-4 shadow-suave',
        oscuro ? 'bg-degradado-marino text-white shadow-marino' : 'border border-borde bg-white',
      )}
    >
      <p className={clsx('text-xs font-semibold uppercase tracking-ancho', oscuro ? 'text-white/60' : 'text-apagado')}>
        {titulo}
      </p>
      <p className={clsx('text-2xl font-extrabold tracking-apretado', oscuro ? 'text-white' : 'text-marino-900')}>
        {valor}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Variacion pct={pct} />
        <div className="h-7 w-20">
          <Sparkline valores={serie} color={colorSpark} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Pagina ----------------------------------- */

export default function Dashboard() {
  const { usuario } = useAuth();
  const { mostrar } = useToast();
  const { estado, feed, total, quitar } = useEventosVivo();

  const [preset, setPreset] = useState<Preset>('30d');
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [rango, setRango] = useState<RangoDashboard>(() => rangoDe('30d'));

  useEffect(() => {
    document.title = 'Dashboard · Área interna';
  }, []);

  function elegirPreset(p: Preset) {
    setPreset(p);
    if (p !== 'personalizado') setRango(rangoDe(p));
  }
  function aplicarPersonalizado(d: string, h: string) {
    setDesde(d);
    setHasta(h);
    // Sin milisegundos: la BD usa DATETIME2(0) y .999 redondearia fuera de rango.
    setRango({ desde: `${d}T00:00:00Z`, hasta: `${h}T23:59:59Z` });
  }

  const resumen = useDashboardResumen(rango);
  const ventas = useVentasPorDia(rango);
  const categorias = useCategoriasDashboard(rango);
  const embudo = useEmbudo(rango);
  const horas = useHorasPico(rango);
  const top = useTopProductosDashboard(rango, 8);
  const cupones = useCuponesDashboard(rango, 8);

  const esAdmin = usuario?.rol === 'Administrador';
  const enCache = Boolean(resumen.data?.cache);

  const serie = useMemo(() => ventas.data?.datos ?? [], [ventas.data?.datos]);
  const serieVenta = useMemo(() => serie.map((p) => p.VentaNeta), [serie]);
  const seriePedidos = useMemo(() => serie.map((p) => p.Pedidos), [serie]);
  const serieTicket = useMemo(() => serie.map((p) => p.TicketPromedio), [serie]);
  const serieUnidades = useMemo(() => serie.map((p) => p.UnidadesNetas), [serie]);

  const q = `desde=${encodeURIComponent(rango.desde)}&hasta=${encodeURIComponent(rango.hasta)}`;
  const exportar = useMutation({
    mutationFn: (ruta: string) => descargarExcelReporte(ruta),
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo exportar', 'error'),
  });
  const BotonExport = ({ ruta }: { ruta: string }) =>
    esAdmin ? (
      <button
        type="button"
        onClick={() => exportar.mutate(ruta)}
        disabled={exportar.isPending}
        className="rounded-pill border border-borde px-3 py-1.5 text-xs font-semibold text-marino-700 hover:bg-fondo-2 disabled:opacity-50"
      >
        Exportar Excel
      </button>
    ) : null;

  const r = resumen.data?.datos;

  return (
    <div className="min-w-0">
      {/* Cabecera */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">
            Hola, {usuario?.nombre?.split(' ')[0] ?? 'equipo'}
          </h1>
          <p className="mt-0.5 text-sm text-apagado">
            {formatearFechaLarga()}
            {enCache && <span className="ml-2 rounded-pill bg-fondo-2 px-2 py-0.5 text-xs">· en caché</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="chip-vivo"
            data-estado={estado}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold',
              estado === 'conectado' ? 'bg-exito/10 text-exito-texto' : 'bg-fondo-2 text-apagado',
            )}
          >
            <span className={clsx('h-2 w-2 rounded-pill', estado === 'conectado' ? 'bg-exito anim-pulso-suave' : 'bg-apagado')} />
            {estado === 'conectado' ? 'En vivo' : 'Reconectando…'}
          </span>
          <span className="text-xs text-apagado">{plural(total, 'evento')} desde que abriste</span>
        </div>
      </div>

      {/* Selector de periodo */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => elegirPreset(p.clave)}
            aria-pressed={preset === p.clave}
            className={clsx(
              'rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors',
              preset === p.clave ? 'bg-marino-700 text-white' : 'border border-borde bg-white text-marino-700 hover:bg-fondo-2',
            )}
          >
            {p.texto}
          </button>
        ))}
        {preset === 'personalizado' && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => aplicarPersonalizado(e.target.value, hasta)}
              className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-1.5 outline-none focus:border-marino-600"
            />
            <span className="text-apagado">→</span>
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => aplicarPersonalizado(desde, e.target.value)}
              className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-1.5 outline-none focus:border-marino-600"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Columna principal */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* KPIs */}
          {resumen.isError ? (
            <Bloque titulo="Indicadores" cargando={false} error onReintentar={() => void resumen.refetch()} altoEsqueleto="h-28">
              <span />
            </Bloque>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {resumen.isPending || !r ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="esqueleto h-28 rounded-20" />)
              ) : (
                <>
                  <KpiCard titulo="Ventas netas" valor={formatearQuetzales(r.VentasNetas)} pct={r.VariacionVentasPct} serie={serieVenta} colorSpark="#F6A21E" oscuro />
                  <KpiCard titulo="Pedidos" valor={String(r.Pedidos)} pct={r.VariacionPedidosPct} serie={seriePedidos} colorSpark="#1E3A8A" />
                  <KpiCard titulo="Ticket promedio" valor={formatearQuetzales(r.TicketPromedio)} pct={r.VariacionTicketPct} serie={serieTicket} colorSpark="#F97316" />
                  <KpiCard titulo="Unidades" valor={String(r.UnidadesVendidas)} pct={r.VariacionUnidadesPct} serie={serieUnidades} colorSpark="#0E7490" />
                </>
              )}
            </div>
          )}

          {/* Ventas por dia + categorias */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Bloque
                titulo="Ventas por día"
                accion={<BotonExport ruta={`/api/v1/reportes/ventas/export?${q}&agrupacion=DIA`} />}
                cargando={ventas.isPending}
                error={ventas.isError}
                onReintentar={() => void ventas.refetch()}
              >
                <GraficaVentas puntos={ventas.data?.datos ?? []} />
              </Bloque>
            </div>
            <Bloque
              titulo="Ventas por categoría"
              accion={<BotonExport ruta={`/api/v1/reportes/categorias/export?${q}`} />}
              cargando={categorias.isPending}
              error={categorias.isError}
              onReintentar={() => void categorias.refetch()}
            >
              <BarrasCategoria categorias={categorias.data?.datos ?? []} />
            </Bloque>
          </div>

          {/* Embudo */}
          <Bloque
            titulo="Embudo de compra"
            subtitulo="Del carrito al pago en el periodo"
            cargando={embudo.isPending}
            error={embudo.isError}
            onReintentar={() => void embudo.refetch()}
            altoEsqueleto="h-44"
          >
            {embudo.data?.datos && <Embudo embudo={embudo.data.datos} />}
          </Bloque>

          {/* Horas pico */}
          <Bloque
            titulo="Horas pico"
            subtitulo="Pedidos por día de la semana y hora · hora local de Guatemala"
            cargando={horas.isPending}
            error={horas.isError}
            onReintentar={() => void horas.refetch()}
            altoEsqueleto="h-44"
          >
            <MapaCalor celdas={horas.data?.datos ?? []} />
          </Bloque>

          {/* Top productos + cupones */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Bloque
              titulo="Top productos"
              accion={<BotonExport ruta={`/api/v1/reportes/top-productos/export?${q}&top=8`} />}
              cargando={top.isPending}
              error={top.isError}
              onReintentar={() => void top.refetch()}
              altoEsqueleto="h-44"
            >
              <TopProductos filas={top.data?.datos ?? []} />
            </Bloque>
            <Bloque
              titulo="Cupones"
              subtitulo="Más usados del periodo"
              cargando={cupones.isPending}
              error={cupones.isError}
              onReintentar={() => void cupones.refetch()}
              altoEsqueleto="h-44"
            >
              <CuponesLista filas={cupones.data?.datos ?? []} />
            </Bloque>
          </div>
        </div>

        {/* Columna "Ahora mismo" (en vivo) */}
        <div className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <FeedVivo estado={estado} feed={feed} onQuitar={quitar} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Sub-bloques --------------------------------- */

function TopProductos({ filas }: { filas: { IDProducto: number; Producto: string; UnidadesNetas: number; MontoNeto: number }[] }) {
  if (filas.length === 0) return <p className="py-8 text-center text-sm text-apagado">Sin ventas en el periodo.</p>;
  const max = Math.max(...filas.map((f) => f.UnidadesNetas), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {filas.map((f, i) => (
        <li key={f.IDProducto} className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-12 bg-fondo-2 text-xs font-extrabold text-marino-700">
            {f.Producto.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-marino-900">{f.Producto}</span>
            <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-pill bg-fondo-2">
              <span
                className="block h-full rounded-pill"
                style={{ width: `${Math.max(4, (f.UnidadesNetas / max) * 100)}%`, backgroundColor: PALETA[i % PALETA.length] }}
              />
            </span>
          </span>
          <span className="shrink-0 text-right text-xs">
            <span className="block font-bold text-marino-900">{plural(f.UnidadesNetas, 'unidad', 'unidades')}</span>
            <span className="text-apagado">{formatearQuetzales(f.MontoNeto)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CuponesLista({ filas }: { filas: { IDCupon: number; Codigo: string; Usos: number; DescuentoOtorgado: number }[] }) {
  if (filas.length === 0) return <p className="py-8 text-center text-sm text-apagado">Sin cupones usados en el periodo.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {filas.map((c) => (
        <li key={c.IDCupon} className="flex items-center justify-between gap-2 rounded-12 border border-borde px-3 py-2">
          <span className="font-mono text-sm font-bold text-marino-900">{c.Codigo}</span>
          <span className="text-right text-xs">
            <span className="block font-semibold text-marino-900">{plural(c.Usos, 'uso')}</span>
            <span className="text-apagado">{formatearQuetzales(c.DescuentoOtorgado)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
