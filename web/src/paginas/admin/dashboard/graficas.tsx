import { useId, useState } from 'react';
import { formatearQuetzales } from '../../../componentes/ui/Precio';
import type { CategoriaVenta, CeldaHoraPico, EmbudoDashboard, Granularidad, PuntoVentaDia } from '../../../api/tipos';

/** Paleta del dashboard (marino, naranja, ambar, azul, gris, cian). Nunca mas de 6 series. */
export const PALETA = ['#0B1F3A', '#F97316', '#F6A21E', '#1E3A8A', '#64748B', '#0E7490'];

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const fmtDiaMes = new Intl.DateTimeFormat('es-GT', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMes = new Intl.DateTimeFormat('es-GT', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Numero de semana ISO (lunes como primer dia), para rotular "sem. 45". */
function semanaISO(d: Date): number {
  const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = (f.getUTCDay() + 6) % 7; // lunes = 0
  f.setUTCDate(f.getUTCDate() - dia + 3); // jueves de esa semana
  const jueves = f.getTime();
  f.setUTCMonth(0, 1);
  if (f.getUTCDay() !== 4) f.setUTCMonth(0, 1 + ((4 - f.getUTCDay() + 7) % 7));
  return 1 + Math.ceil((jueves - f.getTime()) / (7 * 864e5));
}

/** Etiqueta del periodo segun la granularidad: dia ("mié 5 nov"), semana ("sem. 45"), mes ("nov 2026"). */
function etiquetaPeriodo(fecha: string, g: Granularidad): string {
  const d = new Date(fecha);
  if (g === 'MES') return fmtMes.format(d).replace('.', '');
  if (g === 'SEMANA') return `sem. ${semanaISO(d)}`;
  return fmtDiaMes.format(d).replace('.', '');
}

/* --------------------------------- Sparkline -------------------------------- */

/** Mini-serie para las tarjetas KPI (sin ejes). */
export function Sparkline({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length < 2) return <svg viewBox="0 0 100 28" className="h-7 w-full" aria-hidden="true" />;
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const span = max - min || 1;
  const puntos = valores
    .map((v, i) => {
      const x = (i / (valores.length - 1)) * 100;
      const y = 26 - ((v - min) / span) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline points={puntos} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------ Ventas por dia ------------------------------ */

const W = 720;
const H = 240;
const PAD = 28;

export function GraficaVentas({
  puntos,
  granularidad = 'DIA',
  metrica = 'venta',
}: {
  puntos: PuntoVentaDia[];
  granularidad?: Granularidad;
  metrica?: 'venta' | 'pedidos';
}) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (puntos.length === 0) {
    return <p className="py-12 text-center text-sm text-apagado">Sin ventas en el periodo.</p>;
  }

  // La serie activa (quetzales o pedidos). Los montos los calcula la BD; aqui solo se dibujan.
  const valor = (p: PuntoVentaDia) => (metrica === 'venta' ? p.VentaNeta : p.Pedidos);
  const fmtValor = (v: number) => (metrica === 'venta' ? formatearQuetzales(v) : `${v} ${v === 1 ? 'pedido' : 'pedidos'}`);
  const color = metrica === 'venta' ? '#F97316' : '#1E3A8A';
  const colorArea = metrica === 'venta' ? '#F6A21E' : '#1E3A8A';
  const etq = (p: PuntoVentaDia) => etiquetaPeriodo(p.Fecha, granularidad);

  const max = Math.max(...puntos.map(valor), 1);
  const n = puntos.length;
  const x = (i: number) => (n === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (n - 1));
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(valor(p)).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(n - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

  // Etiquetas del eje X: hasta ~7 repartidas.
  const paso = Math.max(1, Math.ceil(n / 7));
  const sel = hover !== null ? (puntos[hover] ?? null) : null;
  const etiquetaEje = granularidad === 'MES' ? 'por mes' : granularidad === 'SEMANA' ? 'por semana' : 'por día';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={`Ventas ${etiquetaEje}`}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorArea} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colorArea} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#area-${gid})`} />
        <path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && sel && (
          <>
            <line x1={x(hover)} y1={PAD - 6} x2={x(hover)} y2={H - PAD} stroke="#64748B" strokeOpacity="0.4" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(valor(sel))} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
          </>
        )}
        {puntos.map((_, i) => (
          <rect
            key={i}
            x={i === 0 ? 0 : (x(i) + x(i - 1)) / 2}
            y={0}
            width={n === 1 ? W : W / n}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
        {puntos.map((p, i) =>
          i % paso === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-apagado" fontSize={11}>
              {etq(p)}
            </text>
          ) : null,
        )}
      </svg>
      {hover !== null && sel && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-12 bg-marino-900 px-3 py-1.5 text-xs font-semibold text-white shadow-marino"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}
        >
          {etq(sel)} · {fmtValor(valor(sel))}
          {metrica === 'venta' && <> · {sel.Pedidos} {sel.Pedidos === 1 ? 'pedido' : 'pedidos'}</>}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Ventas por categoria --------------------------- */

export function BarrasCategoria({ categorias }: { categorias: CategoriaVenta[] }) {
  if (categorias.length === 0) {
    return <p className="py-12 text-center text-sm text-apagado">Sin ventas en el periodo.</p>;
  }
  const top = categorias.slice(0, 6); // nunca mas de 6 series
  const max = Math.max(...top.map((c) => c.MontoNeto), 1);
  return (
    <ul className="flex flex-col gap-3">
      {top.map((c, i) => (
        <li key={c.IDCategoria}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-semibold text-marino-900">{c.Categoria}</span>
            <span className="shrink-0 text-apagado">
              {formatearQuetzales(c.MontoNeto)} · {c.Porcentaje}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-pill bg-fondo-2">
            <div
              className="h-full rounded-pill"
              style={{ width: `${Math.max(2, (c.MontoNeto / max) * 100)}%`, backgroundColor: PALETA[i % PALETA.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- Embudo ----------------------------------- */

export function Embudo({ embudo }: { embudo: EmbudoDashboard }) {
  const pasos = [
    { etiqueta: 'Carritos creados', valor: embudo.CarritosCreados, tasa: null as number | null, rojo: false },
    { etiqueta: 'Con productos', valor: embudo.CarritosConLineas, tasa: embudo.TasaConLineas, rojo: false },
    { etiqueta: 'Inician checkout', valor: embudo.CheckoutsIniciados, tasa: embudo.TasaCheckout, rojo: false },
    { etiqueta: 'Pagos aprobados', valor: embudo.PagosAprobados, tasa: embudo.TasaAprobacion, rojo: false },
    { etiqueta: 'Pagos rechazados', valor: embudo.PagosRechazados, tasa: embudo.TasaRechazo, rojo: true },
  ];
  const max = Math.max(embudo.CarritosCreados, 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {pasos.map((p) => (
        <li key={p.etiqueta}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-marino-900">{p.etiqueta}</span>
            <span className="text-apagado">
              <strong className="text-marino-900">{p.valor}</strong>
              {p.tasa !== null && <span className="ml-2 text-xs">{p.rojo ? 'tasa de rechazo ' : ''}{p.tasa}%</span>}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-pill bg-fondo-2">
            <div
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(2, (p.valor / max) * 100)}%`,
                backgroundColor: p.rojo ? 'rgba(220,38,38,0.55)' : '#1E3A8A',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- Horas pico -------------------------------- */

export function MapaCalor({ celdas }: { celdas: CeldaHoraPico[] }) {
  const [hover, setHover] = useState<{ d: number; h: number; p: number } | null>(null);
  // Matriz 7x24 (dia 1-7 x hora 0-23).
  const grid: number[][] = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let max = 0;
  for (const c of celdas) {
    const fila = grid[c.DiaSemana - 1];
    if (fila && c.Hora >= 0 && c.Hora <= 23) {
      fila[c.Hora] = c.Pedidos;
      if (c.Pedidos > max) max = c.Pedidos;
    }
  }
  if (max === 0) {
    return <p className="py-8 text-center text-sm text-apagado">Sin pedidos en el periodo.</p>;
  }
  return (
    <div className="relative">
      {/* El unico scroll horizontal permitido: dentro de la matriz (es una tabla 7x24). */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="flex">
            <div className="w-9 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-apagado">
                {h % 3 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {grid.map((fila, d) => (
            <div key={d} className="flex items-center">
              <div className="w-9 shrink-0 pr-1 text-right text-[10px] font-semibold text-apagado">{DIAS[d]}</div>
              {fila.map((p, h) => (
                <div
                  key={h}
                  className="m-[1px] aspect-square flex-1 rounded-[3px]"
                  style={{ backgroundColor: p === 0 ? '#eef1f6' : `rgba(246,162,30,${0.15 + 0.85 * (p / max)})` }}
                  onMouseEnter={() => setHover({ d, h, p })}
                  onMouseLeave={() => setHover((x) => (x && x.d === d && x.h === h ? null : x))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {hover && (
        <p className="mt-2 text-center text-xs font-semibold text-marino-900">
          {DIAS_LARGO[hover.d]} {String(hover.h).padStart(2, '0')}:00 · {hover.p}{' '}
          {hover.p === 1 ? 'pedido' : 'pedidos'}
        </p>
      )}
    </div>
  );
}
