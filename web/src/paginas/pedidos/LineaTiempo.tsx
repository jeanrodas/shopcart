import clsx from 'clsx';
import { PASOS_PEDIDO, indicePaso } from '../../lib/pedidos';
import { formatearFechaHoraCorta } from '../../lib/formato';
import { IconoCheck, IconoCerrar, IconoDevolucion } from '../../componentes/iconos';
import type { HistorialEstado } from '../../api/tipos';

type EstadoNodo = 'completado' | 'actual' | 'futuro' | 'cancelado' | 'devuelto';

interface Nodo {
  texto: string;
  estado: EstadoNodo;
  fecha: string | null;
  quien: string | null;
}

interface Props {
  estadoActual: string;
  historial: HistorialEstado[];
  fechaCreacion: string;
  idDuenio: number | undefined;
}

/** Linea de tiempo del pedido: horizontal en escritorio, vertical en movil. */
export function LineaTiempo({ estadoActual, historial, fechaCreacion, idDuenio }: Props) {
  // Entrada del historial que llevo a cada estado (para fecha y autor).
  const porEstado = new Map<string, HistorialEstado>();
  for (const h of historial) porEstado.set(h.EstadoNuevoCodigo, h);

  const quienDe = (h?: HistorialEstado): string | null => {
    if (!h) return null;
    return idDuenio !== undefined && h.IDUsuario === idDuenio ? 'por ti' : 'por operación';
  };

  const nodos: Nodo[] = [];
  const esCancelado = estadoActual === 'CANCELADO';
  const esDevuelto = estadoActual === 'DEVUELTO';

  if (esCancelado) {
    // Hasta donde llego antes de cancelar (PAGADO siempre; EN_PREPARACION si aplico).
    const reachedIdx = PASOS_PEDIDO.reduce(
      (max, p, i) => (porEstado.has(p.codigo) || i === 0 ? i : max),
      0,
    );
    for (let i = 0; i <= reachedIdx; i++) {
      const h = porEstado.get(PASOS_PEDIDO[i]!.codigo);
      nodos.push({
        texto: PASOS_PEDIDO[i]!.texto,
        estado: 'completado',
        fecha: h?.Fecha ?? (i === 0 ? fechaCreacion : null),
        quien: i === 0 ? 'por ti' : quienDe(h),
      });
    }
    const hc = porEstado.get('CANCELADO');
    nodos.push({ texto: 'Cancelado', estado: 'cancelado', fecha: hc?.Fecha ?? null, quien: quienDe(hc) });
  } else {
    const idx = esDevuelto ? PASOS_PEDIDO.length - 1 : indicePaso(estadoActual);
    // ENTREGADO y DEVUELTO son terminales: el ultimo hito va completado (sin pulso).
    const terminal = esDevuelto || estadoActual === 'ENTREGADO';
    PASOS_PEDIDO.forEach((p, i) => {
      const h = porEstado.get(p.codigo);
      nodos.push({
        texto: p.texto,
        estado: i < idx ? 'completado' : i === idx ? (terminal ? 'completado' : 'actual') : 'futuro',
        fecha: h?.Fecha ?? (i === 0 ? fechaCreacion : null),
        quien: i === 0 ? 'por ti' : quienDe(h),
      });
    });
    if (esDevuelto) {
      const hd = porEstado.get('DEVUELTO');
      nodos.push({ texto: 'Devuelto', estado: 'devuelto', fecha: hd?.Fecha ?? null, quien: quienDe(hd) });
    }
  }

  return (
    <ol className="flex flex-col gap-0 lg:flex-row">
      {nodos.map((n, i) => {
        const previoHecho = i > 0 && nodos[i - 1]!.estado !== 'futuro';
        return (
          <li key={i} className="relative flex flex-1 gap-4 pb-6 last:pb-0 lg:flex-col lg:items-center lg:gap-3 lg:pb-0 lg:text-center">
            {/* Conector al nodo previo */}
            {i > 0 && (
              <span
                aria-hidden="true"
                className={clsx(
                  'absolute left-[15px] top-0 h-6 w-0.5 -translate-y-full lg:left-0 lg:top-[16px] lg:h-0.5 lg:w-1/2 lg:translate-x-[-100%] lg:translate-y-0',
                  previoHecho ? 'bg-ambar' : 'bg-fondo-2',
                )}
              />
            )}
            <Circulo estado={n.estado} numero={i + 1} />
            <div className="min-w-0 lg:mt-1">
              <p
                className={clsx(
                  'text-sm font-bold',
                  n.estado === 'futuro'
                    ? 'text-apagado'
                    : n.estado === 'cancelado'
                      ? 'text-[#475569]'
                      : 'text-marino-900',
                )}
              >
                {n.texto}
              </p>
              {n.fecha ? (
                <p className="text-xs text-apagado">
                  {formatearFechaHoraCorta(n.fecha)}
                  {n.quien && <> · {n.quien}</>}
                </p>
              ) : (
                <p className="text-xs text-apagado/70">Pendiente</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Circulo({ estado, numero }: { estado: EstadoNodo; numero: number }) {
  const base = 'relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-pill text-xs font-bold';
  if (estado === 'completado') {
    return (
      <span className={clsx(base, 'bg-degradado-acento text-marino-900')}>
        <IconoCheck className="h-4 w-4" />
      </span>
    );
  }
  if (estado === 'actual') {
    // Marino #0B1F3A con numero y anillo de pulso (se detiene con prefers-reduced-motion).
    return (
      <span className={clsx(base, 'bg-marino-900 text-white')}>
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-pill ring-2 ring-marino-900 motion-safe:animate-ping"
        />
        {numero}
      </span>
    );
  }
  if (estado === 'cancelado') {
    return (
      <span className={clsx(base, 'bg-[#475569] text-white')}>
        <IconoCerrar className="h-4 w-4" />
      </span>
    );
  }
  if (estado === 'devuelto') {
    return (
      <span className={clsx(base, 'bg-[#6D28D9] text-white')}>
        <IconoDevolucion className="h-4 w-4" />
      </span>
    );
  }
  return <span className={clsx(base, 'border border-borde bg-white text-apagado')}>{numero}</span>;
}
