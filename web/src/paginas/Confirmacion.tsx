import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { obtenerPedido } from '../api/pedidos';
import { ErrorApi } from '../api/clienteHttp';
import { limpiarClaveIdem } from '../lib/idempotencia';
import { Boton } from '../componentes/ui/Boton';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { EtiquetaEstadoPedido } from '../componentes/ui/EtiquetaEstadoPedido';
import { formatearQuetzales } from '../componentes/ui/Precio';
import { IconoCheck } from '../componentes/iconos';
import { NoEncontrado } from './NoEncontrado';
import type { ResultadoPago } from '../api/tipos';

interface Info {
  numero: string | null;
  estado: string | null;
  direccion: string | null;
  total: number | null;
  cupon: string | null;
  nombreFactura: string | null;
  nitFactura: string | null;
}

/**
 * Confirmacion AUTOSUFICIENTE: lee :idPedido de la URL y obtiene el pedido con GET /pedidos/:id
 * (TanStack). location.state (resultado del pago) es solo un dato inicial opcional para pintar
 * al instante tras pagar. Si el pedido no existe (404) -> NoEncontrado. NUNCA redirige a /carrito;
 * la regla de "carrito vacio" vive solo en /checkout.
 */
export default function Confirmacion() {
  const { idPedido } = useParams();
  const id = Number(idPedido);
  const idValido = Number.isFinite(id) && id > 0;
  const location = useLocation();
  const resultado = (location.state as { resultado?: ResultadoPago } | null)?.resultado ?? null;

  const pedido = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => obtenerPedido(id),
    enabled: idValido,
    retry: false,
  });

  useEffect(() => {
    document.title = 'Pedido confirmado · ShopCart';
    limpiarClaveIdem();
    return () => {
      document.title = 'ShopCart';
    };
  }, []);

  const info = useMemo<Info | null>(() => {
    // La API manda; el state del pago es solo el dato inicial mientras llega la respuesta.
    if (pedido.data?.pedido) {
      const p = pedido.data.pedido;
      return {
        numero: p.NumeroPedido,
        estado: p.EstadoCodigo,
        direccion: p.DireccionEntrega,
        total: p.Total,
        cupon: p.CuponCodigo,
        nombreFactura: p.NombreFactura,
        nitFactura: p.NITFactura,
      };
    }
    if (resultado?.pedido) {
      const p = resultado.pedido;
      return {
        numero: p.NumeroPedido,
        estado: p.estado.codigo,
        direccion: p.DireccionEntrega,
        total: p.totales.Total,
        cupon: p.cupon,
        nombreFactura: p.NombreFactura,
        nitFactura: p.NITFactura,
      };
    }
    return null;
  }, [pedido.data, resultado]);

  // El pedido no existe (id invalido o 404 de la API): pagina de no encontrado, nunca /carrito.
  const noExiste =
    !idValido || (pedido.isError && pedido.error instanceof ErrorApi && pedido.error.status === 404);
  if (noExiste) return <NoEncontrado />;

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <EstadoVista
        cargando={!info && pedido.isPending}
        error={!info && pedido.isError}
        alReintentar={() => void pedido.refetch()}
        esqueleto={<div className="esqueleto h-72 w-full rounded-20" />}
      >
        {info && (
          <div className="text-center">
            <span className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-pill bg-exito/15 text-exito-texto">
              <IconoCheck className="h-10 w-10" />
            </span>
            <h1 className="text-[32px] font-extrabold tracking-apretado text-marino-900">
              Pedido confirmado
            </h1>
            <p className="mt-1 text-apagado">¡Gracias, tu pedido va en camino!</p>

            <div className="mt-8 rounded-20 border border-borde bg-white p-6 text-left shadow-suave">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">
                    Número de pedido
                  </p>
                  <p className="font-mono text-2xl font-extrabold text-marino-900">{info.numero}</p>
                </div>
                {info.estado && <EtiquetaEstadoPedido codigo={info.estado} />}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-texto">
                Te entregamos en <span className="font-semibold">{info.direccion}</span>. Total
                cobrado <span className="font-semibold">{formatearQuetzales(info.total)}</span>
                {info.cupon ? (
                  <>
                    {' '}
                    con cupón <span className="font-semibold">{info.cupon}</span>
                  </>
                ) : null}
                .
                {info.nitFactura && (
                  <>
                    {' '}
                    Factura a nombre de <span className="font-semibold">{info.nombreFactura}</span> ·
                    NIT <span className="font-mono font-semibold">{info.nitFactura}</span>.
                  </>
                )}
              </p>
            </div>

            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={`/mis-pedidos/${id}`} className="inline-flex">
                <Boton variante="secundario" className="w-full sm:w-auto">
                  Ver mi pedido
                </Boton>
              </Link>
              <Link to="/" className="inline-flex">
                <Boton variante="fantasma" className="w-full sm:w-auto">
                  Seguir comprando
                </Boton>
              </Link>
            </div>
          </div>
        )}
      </EstadoVista>
    </div>
  );
}
