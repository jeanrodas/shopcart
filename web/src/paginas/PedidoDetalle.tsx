import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePedido, useCancelarPedido, useComprarDeNuevo } from '../lib/consultas';
import { ErrorApi } from '../api/clienteHttp';
import { accionCancelar } from '../lib/pedidos';
import { formatearFechaHora } from '../lib/formato';
import { Boton } from '../componentes/ui/Boton';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { EtiquetaEstadoPedido } from '../componentes/ui/EtiquetaEstadoPedido';
import { Precio, formatearQuetzales } from '../componentes/ui/Precio';
import { IconoFlechaIzquierda } from '../componentes/iconos';
import { NoEncontrado } from './NoEncontrado';
import { LineaTiempo } from './pedidos/LineaTiempo';
import { ModalCancelar } from './pedidos/ModalCancelar';
import type { PedidoLineaDetalle, RespuestaPedido } from '../api/tipos';

/** Franja informativa segun el estado. El texto de cancelado menciona el cupon solo si lo hubo. */
function franja(estado: string, tieneCupon: boolean): { tono: string; texto: string } | null {
  switch (estado) {
    case 'PAGADO':
    case 'EN_PREPARACION':
      return { tono: 'bg-marino-600/10 text-marino-700', texto: 'Aún puedes cancelar este pedido hasta que se despache.' };
    case 'DESPACHADO':
      return { tono: 'bg-marino-600/10 text-marino-700', texto: 'Tu pedido va en camino. Pronto llegará a tu dirección.' };
    case 'ENTREGADO':
      return { tono: 'bg-exito/10 text-exito-texto', texto: 'Pedido entregado. Las devoluciones las gestiona el equipo de operación.' };
    case 'DEVUELTO':
      return { tono: 'bg-violet-500/10 text-violet-700', texto: 'Este pedido fue devuelto y la existencia se reintegró.' };
    case 'CANCELADO':
      return {
        tono: 'bg-apagado/15 text-apagado',
        texto: tieneCupon
          ? 'Este pedido fue cancelado. Se reintegró la existencia y el uso del cupón.'
          : 'Este pedido fue cancelado y la existencia se reintegró.',
      };
    default:
      return null;
  }
}

/**
 * Parte el snapshot DireccionEntrega en lineas. Todo lo que sigue al codigo postal
 * (primer segmento de 5 digitos) es la referencia, que puede traer comas propias
 * ("Casa de dos niveles, porton negro"), por eso se une en una sola linea.
 */
function partirDireccion(texto: string): string[] {
  const partes = texto.split(',').map((s) => s.trim()).filter(Boolean);
  const iCP = partes.findIndex((p) => /^\d{5}$/.test(p));
  if (iCP < 0 || iCP >= partes.length - 1) return partes;
  return [...partes.slice(0, iCP + 1), partes.slice(iCP + 1).join(', ')];
}

export default function PedidoDetalle() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { data, isPending, isError, error, refetch } = usePedido(id);
  const cancelar = useCancelarPedido();
  const comprar = useComprarDeNuevo();
  const [modalAbierto, setModalAbierto] = useState(false);

  const numero = data?.pedido.NumeroPedido ?? '';

  useEffect(() => {
    document.title = numero ? `Pedido ${numero} · ShopCart` : 'Pedido · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, [numero]);

  // Reintegro por linea (suma de MontoLinea de las devoluciones de esa linea).
  const reintegroPorLinea = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of data?.devoluciones ?? []) {
      for (const l of d.lineas) {
        m.set(l.IDPedidoDetalle, (m.get(l.IDPedidoDetalle) ?? 0) + l.MontoLinea);
      }
    }
    return m;
  }, [data]);

  // 404 uniforme (pedido inexistente o ajeno) -> pagina de no encontrado.
  if (isError && error instanceof ErrorApi && error.status === 404) {
    return <NoEncontrado />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <EstadoVista
        cargando={isPending}
        error={isError}
        alReintentar={() => void refetch()}
        esqueleto={<div className="esqueleto h-96 w-full rounded-20" />}
      >
        {data && (
          <Contenido
            data={data}
            reintegroPorLinea={reintegroPorLinea}
            cancelando={cancelar.isPending}
            comprando={comprar.isPending}
            onCancelar={() => setModalAbierto(true)}
            onComprarDeNuevo={() =>
              comprar.mutate(data.lineas.map((l) => ({ idVariante: l.IDVariante, cantidad: l.Cantidad })))
            }
          />
        )}
      </EstadoVista>

      {data && (
        <ModalCancelar
          abierto={modalAbierto}
          numero={data.pedido.NumeroPedido}
          cargando={cancelar.isPending}
          onConfirmar={(motivo) =>
            cancelar.mutate(
              { id: data.pedido.IDPedido, motivo },
              { onSettled: () => setModalAbierto(false) },
            )
          }
          onCancelar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}

interface ContenidoProps {
  data: RespuestaPedido;
  reintegroPorLinea: Map<number, number>;
  cancelando: boolean;
  comprando: boolean;
  onCancelar: () => void;
  onComprarDeNuevo: () => void;
}

function Contenido({
  data,
  reintegroPorLinea,
  cancelando,
  comprando,
  onCancelar,
  onComprarDeNuevo,
}: ContenidoProps) {
  const { pedido, lineas, historial, pago } = data;
  const estado = pedido.EstadoCodigo;
  const unidades = lineas.reduce((n, l) => n + l.Cantidad, 0);
  const cancelado = estado === 'CANCELADO';
  const info = franja(estado, Boolean(pedido.CuponCodigo));
  const accion = accionCancelar(estado);
  const lineasDireccion = partirDireccion(pedido.DireccionEntrega);

  return (
    <>
      {/* Migas */}
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-apagado">
        <Link to="/" className="hover:text-marino-700">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <Link to="/mis-pedidos" className="hover:text-marino-700">
          Mis pedidos
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-marino-900">{pedido.NumeroPedido}</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-[28px] font-extrabold tracking-apretado text-marino-900 sm:text-[34px]">
              Pedido {pedido.NumeroPedido}
            </h1>
            <EtiquetaEstadoPedido codigo={estado} />
          </div>
          <p className="mt-1 text-sm text-apagado">
            Realizado el {formatearFechaHora(pedido.FechaCreacion)} · {lineas.length}{' '}
            {lineas.length === 1 ? 'producto' : 'productos'} · {unidades}{' '}
            {unidades === 1 ? 'unidad' : 'unidades'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="fantasma" cargando={comprando} onClick={onComprarDeNuevo}>
            Comprar de nuevo
          </Boton>
          {accion !== 'oculto' && (
            <span title={accion === 'deshabilitado' ? 'Un pedido despachado ya no se puede cancelar' : undefined}>
              <Boton variante="peligro" disabled={accion === 'deshabilitado' || cancelando} onClick={onCancelar}>
                Cancelar pedido
              </Boton>
            </span>
          )}
        </div>
      </div>

      {/* Linea de tiempo */}
      <section className="mb-4 rounded-20 border border-borde bg-white p-6 shadow-suave">
        <LineaTiempo
          estadoActual={estado}
          historial={historial}
          fechaCreacion={pedido.FechaCreacion}
          idDuenio={pedido.IDUsuario}
        />
        {info && <p className={`mt-6 rounded-12 px-4 py-3 text-sm font-medium ${info.tono}`}>{info.texto}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Columna izquierda */}
        <div className="flex flex-col gap-4">
          <section className="rounded-20 border border-borde bg-white p-6 shadow-suave">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">Productos</h2>
              <span className="text-xs text-apagado">precios congelados al momento de la compra</span>
            </div>
            <ul className="flex flex-col divide-y divide-borde">
              {lineas.map((l) => (
                <LineaProducto key={l.IDPedidoDetalle} linea={l} reintegro={reintegroPorLinea.get(l.IDPedidoDetalle)} />
              ))}
            </ul>
          </section>

          <section className="rounded-20 border border-borde bg-white p-6 shadow-suave">
            <h2 className="mb-4 text-lg font-extrabold tracking-apretado text-marino-900">Historial</h2>
            <ol className="flex flex-col gap-4">
              {historial.map((h) => (
                <li key={h.IDPedidoHistorialEstado} className="flex gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-pill bg-marino-600" />
                  <div>
                    <p className="text-sm font-bold text-marino-900">{h.EstadoNuevoNombre}</p>
                    <p className="text-xs text-apagado">
                      {formatearFechaHora(h.Fecha)}
                      {h.UsuarioNombre && <> · {h.UsuarioNombre}</>}
                    </p>
                    {h.Comentario && <p className="mt-0.5 text-xs text-texto">{h.Comentario}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Columna derecha (sticky) */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-ancho text-apagado">Resumen</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <Fila etiqueta="Subtotal" valor={<Precio monto={pedido.Subtotal} />} />
              {pedido.Descuento > 0 && pedido.CuponCodigo && (
                <Fila
                  etiqueta={`Cupón ${pedido.CuponCodigo}`}
                  valor={<span className="font-semibold text-exito-texto">−{formatearQuetzales(pedido.Descuento)}</span>}
                />
              )}
              <Fila etiqueta="Envío" valor={<Precio monto={pedido.CostoEnvio} />} />
            </dl>
            <p className="mt-2 text-xs text-apagado">
              IVA {Math.round(pedido.PorcentajeIVA)}% incluido · {formatearQuetzales(pedido.IVA)}
            </p>
            <div className="mt-3 flex items-baseline justify-between border-t border-borde pt-3">
              <span className="text-sm font-semibold text-marino-900">
                {cancelado ? 'Total del pedido' : 'Total pagado'}
              </span>
              <Precio monto={pedido.Total} className="text-2xl font-extrabold text-marino-900" />
            </div>
          </section>

          <Bloque titulo="Entrega">
            {lineasDireccion.map((linea, i) => (
              <p
                key={i}
                className={i === 0 ? 'text-sm font-semibold text-marino-900' : 'text-sm text-texto'}
              >
                {linea}
              </p>
            ))}
          </Bloque>

          <Bloque titulo="Facturación">
            {pedido.NITFactura ? (
              <>
                <p className="text-sm font-semibold text-marino-900">{pedido.NombreFactura}</p>
                <p className="text-sm text-apagado">NIT {pedido.NITFactura}</p>
              </>
            ) : (
              <p className="text-sm text-texto">Consumidor final</p>
            )}
          </Bloque>

          <Bloque titulo="Pago">
            {pago ? (
              <>
                <p className="text-sm font-semibold text-marino-900">{pago.MetodoPago} (simulado)</p>
                <p className="text-sm text-apagado">
                  {pago.Estado} · ref. <span className="font-mono">{pago.Referencia}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-apagado">Sin pago registrado</p>
            )}
          </Bloque>

          <Link
            to="/mis-pedidos"
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-marino-700 hover:text-marino-600"
          >
            <IconoFlechaIzquierda className="h-4 w-4" />
            Volver a mis pedidos
          </Link>
        </aside>
      </div>
    </>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-apagado">{etiqueta}</dt>
      <dd className="font-semibold text-marino-900">{valor}</dd>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-20 border border-borde bg-white p-5 shadow-suave">
      <h2 className="mb-2 text-sm font-extrabold uppercase tracking-ancho text-apagado">{titulo}</h2>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function LineaProducto({ linea, reintegro }: { linea: PedidoLineaDetalle; reintegro?: number }) {
  const hayDescuento = linea.DescuentoLinea > 0;
  const nombre = linea.ProductoActivo && linea.IDProducto ? (
    <Link to={`/producto/${linea.IDProducto}`} className="font-semibold text-marino-900 hover:text-marino-700">
      {linea.NombreProducto}
    </Link>
  ) : (
    <span className="font-semibold text-marino-900">{linea.NombreProducto}</span>
  );

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <img
        src={linea.ImagenPrincipal ?? ''}
        alt=""
        className="h-[72px] w-[72px] shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover"
      />
      <div className="min-w-0 flex-1">
        {linea.Categoria && (
          <p className="text-xs font-semibold uppercase tracking-ancho text-naranja-600">{linea.Categoria}</p>
        )}
        <p className="truncate">{nombre}</p>
        <p className="text-xs text-apagado">
          {linea.DescripcionVariante ? `${linea.DescripcionVariante} · ` : ''}
          {linea.SKU}
        </p>
        <p className="mt-1 text-sm text-texto">
          {linea.Cantidad} × {formatearQuetzales(linea.PrecioUnitario)}
        </p>
        {reintegro !== undefined && linea.CantidadDevuelta > 0 && (
          <p className="mt-1 inline-block rounded-pill bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-700">
            Devuelta {linea.CantidadDevuelta} de {linea.Cantidad} · reintegro {formatearQuetzales(reintegro)}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {hayDescuento && <p className="text-xs font-semibold text-exito-texto">−{formatearQuetzales(linea.DescuentoLinea)}</p>}
        <Precio monto={linea.TotalLinea} className="font-bold text-marino-900" />
        {hayDescuento && <Precio monto={linea.SubtotalLinea} tachado className="block text-xs text-apagado" />}
      </div>
    </li>
  );
}
