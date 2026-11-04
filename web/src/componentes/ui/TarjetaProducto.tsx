import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { ProductoResumen } from '../../api/tipos';
import { formatearQuetzales } from './Precio';
import { Boton } from './Boton';
import { IconoBolsa, IconoMas } from '../iconos';

export interface OfertaTarjeta {
  precioConCupon: number;
  cupon: string;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  /** Si > 0, el cupon exige esta compra minima (se muestra bajo el precio). */
  montoMinimo?: number;
}

interface Props {
  producto: ProductoResumen;
  /** Destino del detalle del producto. */
  enlace: string;
  /** Insignia "#N" (mas vendidos). */
  posicion?: number;
  /** Datos de oferta; si viene, la tarjeta muestra precio con cupon. */
  oferta?: OfertaTarjeta;
  /** Accion del boton "+". Si no viene, no se muestra. */
  alAgregar?: () => void;
  /** Ancho fijo (p. ej. '272px') para el carrusel. */
  ancho?: string;
  className?: string;
}

function etiquetaDescuento(oferta: OfertaTarjeta): string {
  return oferta.tipoDescuento === 'PORCENTAJE' ? `-${oferta.valor} %` : `-Q ${oferta.valor}`;
}

export function TarjetaProducto({
  producto,
  enlace,
  posicion,
  oferta,
  alAgregar,
  ancho,
  className,
}: Props) {
  const agotado = !producto.HayDisponible;
  const precioDesde = producto.PrecioMinimo ?? 0;

  return (
    <article
      className={clsx(
        'group relative flex flex-col overflow-hidden rounded-20 border border-borde bg-white shadow-suave transition-shadow hover:shadow-elevada',
        className,
      )}
      style={ancho ? { width: ancho } : undefined}
    >
      <Link
        to={enlace}
        className="relative block aspect-square overflow-hidden bg-fondo-2"
        aria-label={producto.Nombre}
      >
        {producto.ImagenPrincipal ? (
          <img
            src={producto.ImagenPrincipal}
            alt={producto.Nombre}
            loading="lazy"
            className={clsx(
              'h-full w-full object-cover transition-transform duration-500 group-hover:scale-105',
              agotado && 'opacity-60 grayscale',
            )}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-degradado-marino text-white/40">
            <IconoBolsa className="h-12 w-12" />
          </div>
        )}

        {posicion !== undefined && (
          <span className="absolute left-3 top-3 rounded-pill bg-marino-900/90 px-2.5 py-1 text-xs font-extrabold text-white">
            #{posicion}
          </span>
        )}

        {oferta && (
          <span className="absolute left-3 top-3 rounded-pill bg-degradado-acento px-2.5 py-1 text-xs font-extrabold text-marino-900 shadow-acento">
            {etiquetaDescuento(oferta)}
          </span>
        )}

        {!agotado && alAgregar && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              alAgregar();
            }}
            aria-label={`Agregar ${producto.Nombre}`}
            className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-pill bg-degradado-acento text-marino-900 shadow-acento transition-opacity hover:brightness-105 md:opacity-0 md:group-hover:opacity-100"
          >
            <IconoMas className="h-5 w-5" />
          </button>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-ancho text-apagado">
          {producto.Categoria}
        </span>
        <Link to={enlace} className="line-clamp-2 text-sm font-bold text-marino-900 hover:text-marino-700">
          {producto.Nombre}
        </Link>

        <div className="mt-1">
          {oferta ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-naranja-600">
                  {formatearQuetzales(oferta.precioConCupon)}
                </span>
                <span className="text-sm text-apagado line-through">
                  {formatearQuetzales(precioDesde)}
                </span>
              </div>
              <p className="text-[11px] text-apagado">con cupón {oferta.cupon}</p>
              {oferta.montoMinimo !== undefined && oferta.montoMinimo > 0 && (
                <p className="text-[11px] text-apagado">
                  en compras desde {formatearQuetzales(oferta.montoMinimo)}
                </p>
              )}
            </>
          ) : (
            <span className="text-base font-extrabold text-marino-900">
              desde {formatearQuetzales(precioDesde)}
            </span>
          )}
        </div>

        <div className="mt-2">
          {agotado ? (
            <div className="flex flex-col gap-2">
              <Indicador tono="gris">Agotado</Indicador>
              <Boton variante="fantasma" tamano="md" disabled className="w-full">
                Avisarme cuando llegue
              </Boton>
            </div>
          ) : producto.BajoStock ? (
            <Indicador tono="ambar">Últimas {producto.DisponibleTotal} unidades</Indicador>
          ) : (
            <Indicador tono="verde">Disponible</Indicador>
          )}
        </div>
      </div>
    </article>
  );
}

function Indicador({ tono, children }: { tono: 'verde' | 'ambar' | 'gris'; children: ReactNode }) {
  const estilos = {
    verde: 'text-exito-texto',
    ambar: 'text-advertencia-texto',
    gris: 'text-apagado',
  }[tono];
  const punto = { verde: 'bg-exito', ambar: 'bg-advertencia', gris: 'bg-apagado' }[tono];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-semibold', estilos)}>
      <span className={clsx('h-1.5 w-1.5 rounded-pill', punto)} />
      {children}
    </span>
  );
}
