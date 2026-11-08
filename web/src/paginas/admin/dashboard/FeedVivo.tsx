import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useResumenOperacion } from '../../../lib/consultas';
import { useQuery } from '@tanstack/react-query';
import { claves } from '../../../lib/claves';
import { obtenerResumenInventario } from '../../../api/inventario';
import { obtenerPedido } from '../../../api/pedidos';
import { ErrorApi } from '../../../api/clienteHttp';
import { useToast } from '../../../componentes/ui/Toast';
import { formatearQuetzales } from '../../../componentes/ui/Precio';
import { IconoAlerta, IconoBolsa, IconoCamion, IconoDevolucion, IconoTarjeta } from '../../../componentes/iconos';
import type { EventoVivo, EstadoConexionVivo } from '../../../api/tipos';

function s(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** "hace Ns" / "hace N min" / "hace N h" a partir del momento de recepcion del evento. */
function relativo(fecha: number): string {
  const seg = Math.max(0, Math.round((Date.now() - fecha) / 1000));
  if (seg < 60) return `hace ${seg} s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}

interface Descripcion {
  Icono: (p: { className?: string }) => ReactNode;
  texto: string;
  link: string;
  color: string;
}

function describir(e: EventoVivo): Descripcion {
  const d = e.datos;
  switch (e.tipo) {
    case 'pedido.creado':
      return {
        Icono: IconoBolsa,
        texto: `${s(d.numero)} · ${formatearQuetzales(Number(d.total))} · ${s(d.cliente) || 'cliente'}`,
        link: '/admin/pedidos',
        color: 'text-exito-texto bg-exito/10',
      };
    case 'pedido.estado':
      return {
        Icono: IconoCamion,
        texto: `${s(d.numero)} · ${s(d.de) || '—'} → ${s(d.a)}`,
        link: '/admin/pedidos',
        color: 'text-marino-700 bg-marino-600/10',
      };
    case 'inventario.movimiento':
      return {
        Icono: IconoDevolucion,
        texto: `${s(d.sku)} · ${s(d.tipo)} · disp ${s(d.disponible)}`,
        link: '/admin/inventario',
        color: 'text-marino-700 bg-marino-600/10',
      };
    case 'inventario.bajoStock':
      return {
        Icono: IconoAlerta,
        texto: `${s(d.sku)} bajó a ${s(d.disponible)} (umbral ${s(d.umbral)})`,
        link: '/admin/inventario',
        color: 'text-error-texto bg-error/10',
      };
    case 'cupon.usado':
      return {
        Icono: IconoTarjeta,
        texto: `${s(d.codigo)} usado en ${s(d.numeroPedido)}`,
        link: '/admin/cupones',
        color: 'text-naranja-700 bg-ambar/15',
      };
    default:
      return { Icono: IconoBolsa, texto: '', link: '/admin', color: 'text-apagado bg-fondo-2' };
  }
}

function Contador({
  etiqueta,
  valor,
  a,
  alerta,
  testid,
}: {
  etiqueta: string;
  valor: number | string;
  a: string;
  alerta?: boolean;
  testid?: string;
}) {
  return (
    <Link
      to={a}
      className={clsx(
        'flex items-center justify-between gap-2 rounded-16 border px-3 py-2.5 transition-colors',
        alerta ? 'border-error/30 bg-error/5 hover:bg-error/10' : 'border-borde bg-white hover:bg-fondo-2',
      )}
    >
      <span className="text-xs font-semibold text-apagado">{etiqueta}</span>
      <span data-testid={testid} className={clsx('text-lg font-extrabold', alerta ? 'text-error-texto' : 'text-marino-900')}>
        {valor}
      </span>
    </Link>
  );
}

export function FeedVivo({
  estado,
  feed,
  onQuitar,
}: {
  estado: EstadoConexionVivo;
  feed: EventoVivo[];
  onQuitar: (id: number) => void;
}) {
  const op = useResumenOperacion();
  const navigate = useNavigate();
  const { mostrar } = useToast();
  const inv = useQuery({
    queryKey: claves.inventario.resumen,
    queryFn: obtenerResumenInventario,
    staleTime: 15_000,
  });

  const conectado = estado === 'conectado';

  // Eventos de pedido: antes de navegar al detalle se verifica que el pedido exista; si ya
  // no existe (404) se avisa y se quita del feed en vez de abrir una pantalla vacia.
  const abrirPedido = async (e: EventoVivo): Promise<void> => {
    const id = Number(e.datos.idPedido);
    if (!Number.isFinite(id) || id <= 0) {
      navigate('/admin/pedidos');
      return;
    }
    try {
      await obtenerPedido(id);
      navigate(`/admin/pedidos/${id}`);
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 404) {
        mostrar('Ese pedido ya no existe', 'error');
        onQuitar(e.id);
      } else {
        navigate('/admin/pedidos');
      }
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
      <h2 className="text-base font-extrabold tracking-apretado text-marino-900">Ahora mismo</h2>

      <div className="grid grid-cols-2 gap-2">
        <Contador etiqueta="Pagados por preparar" valor={op.data?.Pagado ?? '—'} a="/admin/pedidos" testid="contador-pagados" />
        <Contador etiqueta="En preparación" valor={op.data?.EnPreparacion ?? '—'} a="/admin/pedidos" />
        <Contador etiqueta="En ruta" valor={op.data?.Despachado ?? '—'} a="/admin/pedidos" />
        <Contador etiqueta="Bajo stock" valor={inv.data?.resumen?.VariantesBajoStock ?? '—'} a="/admin/inventario" alerta />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-ancho text-apagado">Eventos recientes</p>
        {feed.length === 0 ? (
          <p className="rounded-12 bg-fondo-2 px-3 py-6 text-center text-xs text-apagado">
            {conectado ? 'A la espera de actividad…' : 'Conectando al flujo de eventos…'}
          </p>
        ) : (
          <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
            {feed.map((e) => {
              const { Icono, texto, link, color } = describir(e);
              const clasesItem = 'flex w-full items-start gap-2 rounded-12 border border-borde px-2.5 py-2 text-left hover:bg-fondo-2';
              const interior = (
                <>
                  <span className={clsx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill', color)}>
                    <Icono className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xs font-semibold text-marino-900">{texto}</span>
                    <span className="text-[11px] text-apagado">{relativo(e.fecha)}</span>
                  </span>
                </>
              );
              const esPedido = e.tipo === 'pedido.creado' || e.tipo === 'pedido.estado';
              return (
                <li key={e.id} className="anim-fade">
                  {esPedido ? (
                    <button type="button" onClick={() => void abrirPedido(e)} className={clasesItem}>
                      {interior}
                    </button>
                  ) : (
                    <Link to={link} className={clasesItem}>
                      {interior}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
