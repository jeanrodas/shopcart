import { useState } from 'react';
import {
  useCambiarEstadoPedido,
  useCancelarPedidoOperacion,
  useRegistrarDevolucion,
} from '../../lib/consultas';
import { acciones, siguienteAvance } from '../../lib/operacion';
import { Boton } from '../../componentes/ui/Boton';
import { Modal } from '../../componentes/ui/Modal';
import type { PedidoCabecera, PedidoLineaDetalle } from '../../api/tipos';

interface Props {
  pedido: PedidoCabecera;
  lineas: PedidoLineaDetalle[];
  onHecho?: () => void;
}

/** Transicion + cancelacion + devolucion de un pedido (reutilizado por el panel y el detalle). */
export function AccionesPedido({ pedido, lineas, onHecho }: Props) {
  const id = pedido.IDPedido;

  const [comentario, setComentario] = useState('');
  const [modalCancelar, setModalCancelar] = useState(false);
  const [modalDevolver, setModalDevolver] = useState(false);

  const cambiar = useCambiarEstadoPedido();
  const cancelar = useCancelarPedidoOperacion();

  // Acciones que trae la API (grafo en SQL): no se decide nada por estado aqui.
  const permitidas = acciones(pedido.AccionesPermitidas);
  const paso = siguienteAvance(pedido.AccionesPermitidas);
  const puedeCancelar = permitidas.has('CANCELAR');
  const puedeDev = permitidas.has('DEVOLVER');

  const avanzar = () => {
    if (!paso) return;
    // Un avance lineal NO cierra el panel: refresca el detalle (invalidacion) y deja a la
    // vista el nuevo estado con su siguiente accion, para encadenar Preparar -> Despachar
    // -> Entregar. onHecho se reserva para cancelacion y devolucion (salen del flujo).
    cambiar.mutate(
      { id, estado: paso.estado, comentario: comentario.trim() || undefined },
      { onSuccess: () => setComentario('') },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Comentario para el historial (opcional) */}
      {(paso || puedeCancelar) && (
        <div>
          <label className="mb-1 block text-sm font-semibold text-texto">Comentario (va al historial)</label>
          <textarea
            rows={2}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Opcional"
            className="w-full rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600"
          />
        </div>
      )}

      {/* Transicion / devolucion */}
      <div className="flex flex-wrap gap-2">
        {paso && (
          <Boton cargando={cambiar.isPending} onClick={avanzar}>
            {paso.texto}
          </Boton>
        )}
        {puedeDev && (
          <Boton variante="secundario" className="bg-violet-600 hover:bg-violet-500" onClick={() => setModalDevolver(true)}>
            Registrar devolución
          </Boton>
        )}
        {puedeCancelar && (
          <Boton variante="peligro" onClick={() => setModalCancelar(true)}>
            Cancelar
          </Boton>
        )}
        {!paso && !puedeDev && !puedeCancelar && (
          <p className="text-sm text-apagado">Este pedido está en un estado terminal; no admite más transiciones.</p>
        )}
      </div>

      <p className="text-[11px] text-apagado">
        Transiciones permitidas: PAGADO → En preparación → Despachado → Entregado; cancelación solo
        desde Pagado o En preparación; la devolución es exclusiva de pedidos entregados.
      </p>

      {modalCancelar && (
        <ModalCancelar
          numero={pedido.NumeroPedido}
          cargando={cancelar.isPending}
          onCerrar={() => setModalCancelar(false)}
          onConfirmar={(motivo) =>
            cancelar.mutate({ id, motivo }, { onSuccess: () => { setModalCancelar(false); onHecho?.(); } })
          }
        />
      )}

      {modalDevolver && (
        <ModalDevolucion
          idPedido={id}
          lineas={lineas}
          onCerrar={() => setModalDevolver(false)}
          onHecho={() => { setModalDevolver(false); onHecho?.(); }}
        />
      )}
    </div>
  );
}

function ModalCancelar({
  numero,
  cargando,
  onCerrar,
  onConfirmar,
}: {
  numero: string;
  cargando: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= 3;
  return (
    <Modal
      abierto
      titulo={`Cancelar ${numero}`}
      textoConfirmar="Cancelar pedido"
      textoCancelar="Volver"
      varianteConfirmar="peligro"
      cargando={cargando}
      alConfirmar={() => valido && onConfirmar(motivo.trim())}
      alCancelar={onCerrar}
    >
      <p className="mb-2">Se repondrá la existencia y, si tenía cupón, se devolverá su uso. El reembolso es simulado.</p>
      <label className="mb-1 block text-sm font-semibold text-texto">Motivo</label>
      <textarea
        rows={2}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="w-full rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600"
      />
      {!valido && motivo.length > 0 && <p className="mt-1 text-xs text-error-texto">Mínimo 3 caracteres.</p>}
    </Modal>
  );
}

function ModalDevolucion({
  idPedido,
  lineas,
  onCerrar,
  onHecho,
}: {
  idPedido: number;
  lineas: PedidoLineaDetalle[];
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const devolver = useRegistrarDevolucion();
  const conPendiente = lineas.filter((l) => l.Cantidad - l.CantidadDevuelta > 0);
  const [cant, setCant] = useState<Record<number, number>>({});
  const [motivo, setMotivo] = useState('');

  const seleccionadas = Object.entries(cant)
    .map(([k, v]) => ({ idPedidoDetalle: Number(k), cantidad: v }))
    .filter((x) => x.cantidad > 0);
  const valido = seleccionadas.length > 0 && motivo.trim().length >= 3;

  const enviar = () => {
    if (!valido) return;
    devolver.mutate({ id: idPedido, motivo: motivo.trim(), lineas: seleccionadas }, { onSuccess: onHecho });
  };

  return (
    <Modal
      abierto
      titulo="Registrar devolución"
      textoConfirmar="Registrar devolución"
      textoCancelar="Cancelar"
      varianteConfirmar="primario"
      cargando={devolver.isPending}
      alConfirmar={enviar}
      alCancelar={onCerrar}
    >
      <div className="flex flex-col gap-3">
        {conPendiente.length === 0 && <p>Todas las líneas ya fueron devueltas.</p>}
        {conPendiente.map((l) => {
          const pendiente = l.Cantidad - l.CantidadDevuelta;
          return (
            <div key={l.IDPedidoDetalle} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-marino-900">{l.NombreProducto}</p>
                <p className="font-mono text-xs text-apagado">{l.SKU} · pendiente {pendiente}</p>
              </div>
              <input
                type="number"
                min={0}
                max={pendiente}
                value={cant[l.IDPedidoDetalle] ?? 0}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(pendiente, Number(e.target.value) || 0));
                  setCant((c) => ({ ...c, [l.IDPedidoDetalle]: v }));
                }}
                className="w-20 rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-marino-600"
              />
            </div>
          );
        })}
        {conPendiente.length > 0 && (
          <>
            <label className="block text-sm font-semibold text-texto">Motivo</label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-marino-600"
            />
            <p className="text-xs text-apagado">
              La existencia de cada línea devuelta vuelve al inventario y el monto se reintegra
              (simulado). Si todas las líneas quedan devueltas, el pedido pasa a Devuelto.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
