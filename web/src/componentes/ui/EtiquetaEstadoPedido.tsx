import clsx from 'clsx';

type CodigoEstado =
  | 'PAGADO'
  | 'EN_PREPARACION'
  | 'DESPACHADO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'DEVUELTO';

interface Config {
  texto: string;
  punto: string;
  clases: string;
}

const ESTADOS: Record<CodigoEstado, Config> = {
  PAGADO: { texto: 'Pagado', punto: 'bg-marino-600', clases: 'bg-marino-600/10 text-marino-700' },
  EN_PREPARACION: {
    texto: 'En preparación',
    punto: 'bg-naranja',
    clases: 'bg-naranja/10 text-naranja-700',
  },
  DESPACHADO: { texto: 'Despachado', punto: 'bg-violet-500', clases: 'bg-violet-500/10 text-violet-700' },
  ENTREGADO: { texto: 'Entregado', punto: 'bg-exito', clases: 'bg-exito/10 text-exito-texto' },
  CANCELADO: { texto: 'Cancelado', punto: 'bg-apagado', clases: 'bg-apagado/15 text-apagado' },
  DEVUELTO: { texto: 'Devuelto', punto: 'bg-error', clases: 'bg-error/10 text-error-texto' },
};

interface Props {
  codigo: string;
  className?: string;
}

/** Etiqueta pill con punto + texto del estado de un pedido. */
export function EtiquetaEstadoPedido({ codigo, className }: Props) {
  const cfg = ESTADOS[codigo as CodigoEstado] ?? {
    texto: codigo,
    punto: 'bg-apagado',
    clases: 'bg-apagado/15 text-apagado',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold',
        cfg.clases,
        className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-pill', cfg.punto)} />
      {cfg.texto}
    </span>
  );
}
