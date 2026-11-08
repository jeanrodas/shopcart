import { type ReactNode } from 'react';
import clsx from 'clsx';
import { Boton } from './Boton';
import { IconoAlerta, IconoBolsa } from '../iconos';

/** Tarjeta-esqueleto con shimmer, del tamano de una TarjetaProducto. */
export function TarjetaEsqueleto({ className }: { className?: string }) {
  return (
    <div className={clsx('overflow-hidden rounded-20 border border-borde bg-white', className)}>
      <div className="esqueleto aspect-square w-full" />
      <div className="flex flex-col gap-2 p-4">
        <div className="esqueleto h-3 w-1/3 rounded-pill" />
        <div className="esqueleto h-4 w-3/4 rounded-pill" />
        <div className="esqueleto h-5 w-1/2 rounded-pill" />
      </div>
    </div>
  );
}

function EstadoCargando({ children, cantidad }: { children?: ReactNode; cantidad?: number }) {
  if (children) return <>{children}</>;
  const n = cantidad ?? 4;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <TarjetaEsqueleto key={i} />
      ))}
    </div>
  );
}

function EstadoVacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-20 border border-borde bg-white px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-16 bg-gradient-to-br from-fondo to-fondo-2 text-marino-600">
        <IconoBolsa className="h-7 w-7" />
      </span>
      <h3 className="text-base font-bold text-marino-900">{titulo}</h3>
      {texto && <p className="max-w-sm text-sm text-apagado">{texto}</p>}
      {accion}
    </div>
  );
}

function EstadoError({
  titulo = 'No pudimos cargar esta seccion',
  texto = 'Revisa tu conexion e intenta de nuevo.',
  alReintentar,
}: {
  titulo?: string;
  texto?: string;
  alReintentar?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-20 border border-error/30 bg-white px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-16 bg-error/10 text-error">
        <IconoAlerta className="h-7 w-7" />
      </span>
      <h3 className="text-base font-bold text-marino-900">{titulo}</h3>
      <p className="max-w-sm text-sm text-apagado">{texto}</p>
      {alReintentar && (
        <Boton variante="fantasma" onClick={alReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

interface Props {
  cargando: boolean;
  error: boolean;
  vacio?: boolean;
  alReintentar?: () => void;
  /** Esqueleto a medida; si no, se generan tarjetas segun cantidadEsqueleto. */
  esqueleto?: ReactNode;
  cantidadEsqueleto?: number;
  tituloError?: string;
  textoError?: string;
  tituloVacio?: string;
  textoVacio?: string;
  accionVacio?: ReactNode;
  children: ReactNode;
}

/** Muestra el estado adecuado (cargando / error / vacio) o el contenido. */
export function EstadoVista({
  cargando,
  error,
  vacio = false,
  alReintentar,
  esqueleto,
  cantidadEsqueleto,
  tituloError,
  textoError,
  tituloVacio = 'Nada por aqui todavia',
  textoVacio,
  accionVacio,
  children,
}: Props) {
  if (cargando) return <EstadoCargando cantidad={cantidadEsqueleto}>{esqueleto}</EstadoCargando>;
  if (error) return <EstadoError titulo={tituloError} texto={textoError} alReintentar={alReintentar} />;
  if (vacio) return <EstadoVacio titulo={tituloVacio} texto={textoVacio} accion={accionVacio} />;
  return <>{children}</>;
}
