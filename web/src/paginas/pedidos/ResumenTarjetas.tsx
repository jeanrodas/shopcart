import clsx from 'clsx';
import { formatearFechaCorta } from '../../lib/formato';
import { formatearQuetzales } from '../../componentes/ui/Precio';
import { IconoBolsa, IconoCamion, IconoCheck, IconoReloj } from '../../componentes/iconos';
import type { ResumenPedidos } from '../../api/tipos';

const TARJETA = 'snap-start shrink-0 basis-[78%] rounded-20 border p-5 sm:basis-[46%] lg:basis-auto';

function Valor({ children, oscuro }: { children: React.ReactNode; oscuro?: boolean }) {
  return (
    <p className={clsx('mt-2 text-3xl font-extrabold tracking-apretado', oscuro ? 'text-white' : 'text-marino-900')}>
      {children}
    </p>
  );
}

export function ResumenTarjetas({ resumen, cargando }: { resumen?: ResumenPedidos; cargando: boolean }) {
  if (cargando || !resumen) {
    return (
      <div className="mb-8 flex gap-4 overflow-x-auto pb-1 sin-barra lg:grid lg:grid-cols-4 lg:overflow-visible">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={clsx(TARJETA, 'border-borde bg-white')}>
            <div className="esqueleto h-4 w-24 rounded-pill" />
            <div className="esqueleto mt-3 h-8 w-16 rounded-pill" />
            <div className="esqueleto mt-3 h-3 w-full rounded-pill" />
          </div>
        ))}
      </div>
    );
  }

  const cancelados = resumen.Cancelado;

  return (
    <div className="mb-8 flex gap-4 overflow-x-auto pb-1 sin-barra lg:grid lg:grid-cols-4 lg:overflow-visible">
      {/* En camino: fondo degradado marino. */}
      <div className={clsx(TARJETA, 'border-transparent bg-degradado-marino text-white shadow-marino')}>
        <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <IconoCamion className="h-4 w-4" />
          En camino
        </div>
        <Valor oscuro>{resumen.Despachado}</Valor>
        <p className="mt-2 text-xs text-white/70">
          {resumen.DespachadoNumero ? (
            <>
              <span className="font-mono font-semibold text-dorado">{resumen.DespachadoNumero}</span>
              {resumen.DespachadoFechaEstimada && (
                <> · llega {formatearFechaCorta(resumen.DespachadoFechaEstimada)}</>
              )}
            </>
          ) : (
            'Sin envíos en curso'
          )}
        </p>
      </div>

      {/* En preparacion. */}
      <div className={clsx(TARJETA, 'border-borde bg-white')}>
        <div className="flex items-center gap-2 text-sm font-semibold text-apagado">
          <IconoReloj className="h-4 w-4" />
          En preparación
        </div>
        <Valor>{resumen.EnPreparacion}</Valor>
        <p className="mt-2 text-xs text-apagado">Puedes cancelar hasta que se despache</p>
      </div>

      {/* Entregados. */}
      <div className={clsx(TARJETA, 'border-borde bg-white')}>
        <div className="flex items-center gap-2 text-sm font-semibold text-apagado">
          <IconoCheck className="h-4 w-4" />
          Entregados
        </div>
        <Valor>{resumen.Entregado}</Valor>
        <p className="mt-2 text-xs text-apagado">
          {resumen.UltimoEntregadoFecha
            ? `Último: ${formatearFechaCorta(resumen.UltimoEntregadoFecha)}`
            : 'Aún ninguno'}
        </p>
      </div>

      {/* Total comprado. */}
      <div className={clsx(TARJETA, 'border-borde bg-white')}>
        <div className="flex items-center gap-2 text-sm font-semibold text-apagado">
          <IconoBolsa className="h-4 w-4" />
          Total comprado
        </div>
        <Valor>{formatearQuetzales(resumen.TotalComprado)}</Valor>
        <p className="mt-2 text-xs text-apagado">
          {cancelados === 0
            ? 'Sin pedidos cancelados'
            : `${cancelados} ${cancelados === 1 ? 'cancelado' : 'cancelados'}`}
        </p>
      </div>
    </div>
  );
}
