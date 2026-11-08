import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { Boton } from '../../componentes/ui/Boton';
import { EtiquetaEstadoPedido } from '../../componentes/ui/EtiquetaEstadoPedido';
import { Precio, formatearQuetzales } from '../../componentes/ui/Precio';
import { formatearFechaCorta } from '../../lib/formato';
import { PASOS_PEDIDO, enCurso, indicePaso } from '../../lib/pedidos';
import { acciones } from '../../lib/operacion';
import { resolverImagen } from '../../lib/imagenes';
import type { PedidoListado } from '../../api/tipos';

/** Mini linea de progreso de 4 pasos; el actual en naranja, los previos en degradado ambar. */
function ProgresoMini({ codigo }: { codigo: string }) {
  const idx = indicePaso(codigo);
  if (idx < 0) return null;
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="flex gap-1">
        {PASOS_PEDIDO.map((p, i) => (
          <span
            key={p.codigo}
            className={clsx(
              'h-1.5 flex-1 rounded-pill',
              i < idx && 'bg-degradado-acento',
              i === idx && 'bg-naranja',
              i > idx && 'bg-fondo-2',
            )}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-semibold text-apagado">
        {PASOS_PEDIDO.map((p, i) => (
          <span key={p.codigo} className={clsx(i === idx && 'text-naranja-700')}>
            {p.texto}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Miniaturas apiladas (hasta 3, borde blanco). */
function Miniaturas({ urls }: { urls: (string | null)[] }) {
  const imgs = urls.filter((u): u is string => !!u);
  if (imgs.length === 0) return null;
  return (
    <div className="flex">
      {imgs.map((url, i) => (
        <img
          key={i}
          src={resolverImagen(url)}
          alt=""
          className={clsx(
            'h-11 w-11 rounded-12 border-2 border-white bg-fondo-2 object-cover shadow-suave',
            i > 0 && '-ml-3',
          )}
          style={{ zIndex: imgs.length - i }}
        />
      ))}
    </div>
  );
}

interface Props {
  pedido: PedidoListado;
  cancelando: boolean;
  comprando: boolean;
  onCancelar: (p: PedidoListado) => void;
  onComprarDeNuevo: (p: PedidoListado) => void;
}

export function TarjetaPedido({ pedido, cancelando, comprando, onCancelar, onComprarDeNuevo }: Props) {
  const esCancelado = pedido.EstadoCodigo === 'CANCELADO';
  const esDevuelto = pedido.EstadoCodigo === 'DEVUELTO';
  const activo = enCurso(pedido.EstadoCodigo);
  // La API decide si se puede cancelar (AccionesPermitidas, grafo en SQL); el front solo lo lee.
  const puedeCancelar = acciones(pedido.AccionesPermitidas).has('CANCELAR');
  const detalle = `/mis-pedidos/${pedido.IDPedido}`;

  return (
    <article
      className={clsx(
        'rounded-20 border border-borde bg-white p-5 shadow-suave',
        esCancelado && 'opacity-85',
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Columna izquierda: identidad + progreso + productos */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={detalle}
              className="font-mono text-lg font-extrabold text-marino-900 hover:text-marino-700"
            >
              {pedido.NumeroPedido}
            </Link>
            <EtiquetaEstadoPedido codigo={pedido.EstadoCodigo} />
            {esDevuelto && pedido.UnidadesDevueltas > 0 && (
              <span className="rounded-pill bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {pedido.UnidadesDevueltas}{' '}
                {pedido.UnidadesDevueltas === 1 ? 'unidad devuelta' : 'unidades devueltas'}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-apagado">
            {formatearFechaCorta(pedido.FechaCreacion)} · {pedido.CantidadLineas}{' '}
            {pedido.CantidadLineas === 1 ? 'producto' : 'productos'}
          </p>

          {!esCancelado && <ProgresoMini codigo={pedido.EstadoCodigo} />}

          <div className="mt-4 flex items-center gap-3">
            <Miniaturas urls={[pedido.Img1, pedido.Img2, pedido.Img3]} />
            {pedido.NombresResumen && (
              <p className="min-w-0 flex-1 truncate text-sm text-texto">{pedido.NombresResumen}</p>
            )}
          </div>
        </div>

        {/* Columna derecha: total + cupon + acciones */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-borde pt-4 lg:w-56 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Total</p>
            <Precio
              monto={pedido.Total}
              tachado={esCancelado}
              className={clsx(
                'text-xl font-extrabold',
                esCancelado ? 'text-apagado' : 'text-marino-900',
              )}
            />
            {pedido.Descuento > 0 && pedido.CuponCodigo && (
              <p className="mt-0.5 text-xs font-semibold text-exito-texto">
                Cupón {pedido.CuponCodigo} · −{formatearQuetzales(pedido.Descuento)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Link to={detalle} className="inline-flex">
              <Boton variante={activo ? 'primario' : 'fantasma'} className="w-full">
                Ver detalle
              </Boton>
            </Link>
            {puedeCancelar && (
              <button
                type="button"
                onClick={() => onCancelar(pedido)}
                disabled={cancelando}
                className="inline-flex min-h-[44px] items-center justify-center rounded-pill bg-error/10 px-5 text-sm font-semibold text-error-texto transition-colors hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar pedido
              </button>
            )}
            {!esCancelado && (
              <Boton
                variante="fantasma"
                className="w-full"
                cargando={comprando}
                onClick={() => onComprarDeNuevo(pedido)}
              >
                Comprar de nuevo
              </Boton>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
