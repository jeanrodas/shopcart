import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePedidoOperacion } from '../../lib/consultas';
import { ErrorApi } from '../../api/clienteHttp';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { EtiquetaEstadoPedido } from '../../componentes/ui/EtiquetaEstadoPedido';
import { Precio, formatearQuetzales } from '../../componentes/ui/Precio';
import { resolverImagen } from '../../lib/imagenes';
import { formatearFechaHora } from '../../lib/formato';
import { IconoFlechaIzquierda } from '../../componentes/iconos';
import { NoEncontrado } from '../NoEncontrado';
import { LineaTiempo } from '../pedidos/LineaTiempo';
import { AccionesPedido } from './AccionesPedido';

/** Detalle de un pedido en modo operacion (/admin/pedidos/:id). Sin "Comprar de nuevo". */
export default function PedidoOperacion() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { data, isPending, isError, error, refetch } = usePedidoOperacion(id);

  const numero = data?.pedido.NumeroPedido ?? '';
  useEffect(() => {
    document.title = numero ? `Pedido ${numero} · Operación` : 'Pedido · Operación';
  }, [numero]);

  if (isError && error instanceof ErrorApi && error.status === 404) return <NoEncontrado />;

  return (
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Migas" className="mb-4 text-sm text-apagado">
        <Link to="/admin/pedidos" className="hover:text-marino-700">Pedidos</Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-marino-900">{numero || '…'}</span>
      </nav>

      <EstadoVista cargando={isPending} error={isError} alReintentar={() => void refetch()} esqueleto={<div className="esqueleto h-96 w-full rounded-20" />}>
        {data && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[28px] font-extrabold tracking-apretado text-marino-900">Pedido {data.pedido.NumeroPedido}</h1>
              <EtiquetaEstadoPedido codigo={data.pedido.EstadoCodigo} />
              <span className="text-sm text-apagado">· {formatearFechaHora(data.pedido.FechaCreacion)}</span>
            </div>

            <section className="mb-4 rounded-20 border border-borde bg-white p-6 shadow-suave">
              <LineaTiempo
                estadoActual={data.pedido.EstadoCodigo}
                historial={data.historial}
                fechaCreacion={data.pedido.FechaCreacion}
                idDuenio={data.pedido.IDUsuario}
              />
            </section>

            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="flex flex-col gap-4">
                <section className="rounded-20 border border-borde bg-white p-6 shadow-suave">
                  <h2 className="mb-4 text-lg font-extrabold tracking-apretado text-marino-900">Productos</h2>
                  <ul className="flex flex-col divide-y divide-borde">
                    {data.lineas.map((l) => (
                      <li key={l.IDPedidoDetalle} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <img src={resolverImagen(l.ImagenPrincipal)} alt="" className="h-[60px] w-[60px] shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-marino-900">{l.NombreProducto}</p>
                          <p className="text-xs text-apagado">{l.DescripcionVariante ? `${l.DescripcionVariante} · ` : ''}<span className="font-mono">{l.SKU}</span></p>
                          <p className="mt-1 text-sm text-texto">{l.Cantidad} × {formatearQuetzales(l.PrecioUnitario)}</p>
                          {l.CantidadDevuelta > 0 && (
                            <p className="mt-1 inline-block rounded-pill bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-700">
                              Devuelta {l.CantidadDevuelta} de {l.Cantidad}
                            </p>
                          )}
                        </div>
                        <Precio monto={l.TotalLinea} className="shrink-0 font-bold text-marino-900" />
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-20 border border-borde bg-white p-6 shadow-suave">
                  <h2 className="mb-4 text-lg font-extrabold tracking-apretado text-marino-900">Historial</h2>
                  <ol className="flex flex-col gap-4">
                    {data.historial.map((h) => (
                      <li key={h.IDPedidoHistorialEstado} className="flex gap-3">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-pill bg-marino-600" />
                        <div>
                          <p className="text-sm font-bold text-marino-900">{h.EstadoNuevoNombre}</p>
                          <p className="text-xs text-apagado">{formatearFechaHora(h.Fecha)}{h.UsuarioNombre && <> · {h.UsuarioNombre}</>}</p>
                          {h.Comentario && <p className="mt-0.5 text-xs text-texto">{h.Comentario}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <aside className="flex flex-col gap-4">
                <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
                  <h2 className="mb-3 text-sm font-extrabold uppercase tracking-ancho text-apagado">Acciones</h2>
                  <AccionesPedido pedido={data.pedido} lineas={data.lineas} />
                </section>

                <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
                  <h2 className="mb-2 text-sm font-extrabold uppercase tracking-ancho text-apagado">Cliente y entrega</h2>
                  <p className="text-sm font-semibold text-marino-900">{data.pedido.ClienteNombre}</p>
                  <p className="text-xs text-apagado">{data.pedido.ClienteCorreo}</p>
                  <p className="mt-2 text-sm text-texto">{data.pedido.DireccionEntrega}</p>
                </section>

                <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
                  <h2 className="mb-2 text-sm font-extrabold uppercase tracking-ancho text-apagado">Facturación</h2>
                  {data.pedido.NITFactura ? (
                    <>
                      <p className="text-sm font-semibold text-marino-900">{data.pedido.NombreFactura}</p>
                      <p className="text-sm text-apagado">NIT {data.pedido.NITFactura}</p>
                    </>
                  ) : (
                    <p className="text-sm text-texto">Consumidor final</p>
                  )}
                  <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-2">
                    <span className="text-sm font-semibold text-marino-900">Total</span>
                    <Precio monto={data.pedido.Total} className="text-xl font-extrabold text-marino-900" />
                  </div>
                </section>

                <Link to="/admin/pedidos" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-marino-700 hover:text-marino-600">
                  <IconoFlechaIzquierda className="h-4 w-4" /> Volver a pedidos
                </Link>
              </aside>
            </div>
          </>
        )}
      </EstadoVista>
    </div>
  );
}
