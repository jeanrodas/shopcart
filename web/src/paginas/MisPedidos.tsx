import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { usePedidos, useResumenPedidos, useCancelarPedido, useComprarDeNuevo } from '../lib/consultas';
import { obtenerPedido } from '../api/pedidos';
import { FILTROS_ESTADO } from '../lib/pedidos';
import { Boton } from '../componentes/ui/Boton';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { IconoBolsa, IconoBuscar } from '../componentes/iconos';
import { ResumenTarjetas } from './pedidos/ResumenTarjetas';
import { TarjetaPedido } from './pedidos/TarjetaPedido';
import { ModalCancelar } from './pedidos/ModalCancelar';
import { Paginacion } from './catalogo/Paginacion';
import type { FiltrosPedidos, PedidoListado } from '../api/tipos';

const TAMANO = 12;

export default function MisPedidos() {
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [orden, setOrden] = useState<'DESC' | 'ASC'>('DESC');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(TAMANO);
  const [busqueda, setBusqueda] = useState('');
  const [numero, setNumero] = useState('');

  // Debounce de la busqueda por numero (300 ms) -> va al servidor.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setNumero(busqueda.trim());
      setPagina(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  const codigos = FILTROS_ESTADO.find((f) => f.clave === filtroEstado)?.codigos;
  const filtros: FiltrosPedidos = useMemo(
    () => ({ estado: codigos, numero: numero || undefined, orden, pagina, tamano }),
    [codigos, numero, orden, pagina, tamano],
  );

  const { data, isPending, isError, refetch } = usePedidos(filtros);
  const { data: resumen, isPending: cargandoResumen } = useResumenPedidos();
  const cancelar = useCancelarPedido();
  const comprar = useComprarDeNuevo();

  const [aCancelar, setACancelar] = useState<PedidoListado | null>(null);
  const [comprandoId, setComprandoId] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Mis pedidos · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, []);

  // Si la pagina solicitada supera el total (p. ej. tras filtrar), vuelve a 1.
  const total = data?.total ?? 0;
  useEffect(() => {
    if (data && pagina > 1 && total <= (pagina - 1) * tamano) setPagina(1);
  }, [data, pagina, tamano, total]);

  const pedidos = data?.filas ?? [];
  const sinNingunPedido = resumen?.Total === 0;

  function confirmarCancelacion(motivo: string) {
    if (!aCancelar) return;
    cancelar.mutate(
      { id: aCancelar.IDPedido, motivo },
      { onSettled: () => setACancelar(null) },
    );
  }

  async function comprarDeNuevo(p: PedidoListado) {
    setComprandoId(p.IDPedido);
    try {
      const detalle = await obtenerPedido(p.IDPedido);
      const lineas = detalle.lineas.map((l) => ({ idVariante: l.IDVariante, cantidad: l.Cantidad }));
      comprar.mutate(lineas);
    } catch {
      // obtenerPedido no deberia fallar para un pedido propio; si falla, no hay nada que agregar.
    } finally {
      setComprandoId(null);
    }
  }

  function conteo(claves: string[]): number {
    if (!resumen) return 0;
    return claves.reduce((n, c) => n + ((resumen as unknown as Record<string, number>)[c] ?? 0), 0);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Migas */}
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-apagado">
        <Link to="/" className="hover:text-marino-700">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-marino-900">Mis pedidos</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-apretado text-marino-900 sm:text-[40px]">
            Mis pedidos
          </h1>
          <p className="mt-1 text-sm text-apagado">
            {resumen ? (
              <>
                {resumen.Total} {resumen.Total === 1 ? 'pedido' : 'pedidos'} · {resumen.Despachado} en
                camino
              </>
            ) : (
              'Cargando resumen…'
            )}
          </p>
        </div>
        {/* Buscador por numero */}
        <form role="search" onSubmit={(e) => e.preventDefault()} className="w-full sm:w-auto">
          <div className="flex items-center gap-2 rounded-pill border border-borde bg-white px-4 py-2">
            <IconoBuscar className="h-4 w-4 text-apagado" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por número (SC-…)"
              aria-label="Buscar pedidos por número"
              className="w-full bg-transparent text-sm text-texto outline-none placeholder:text-apagado sm:w-56"
            />
          </div>
        </form>
      </div>

      <ResumenTarjetas resumen={resumen} cargando={cargandoResumen} />

      {/* Filtros por estado + orden */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-2">
          {FILTROS_ESTADO.map((f) => {
            const activo = f.clave === filtroEstado;
            return (
              <button
                key={f.clave}
                type="button"
                onClick={() => {
                  setFiltroEstado(f.clave);
                  setPagina(1);
                }}
                aria-pressed={activo}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  activo
                    ? 'bg-marino-700 text-white'
                    : 'border border-borde bg-white text-marino-700 hover:bg-fondo-2',
                )}
              >
                {f.texto}
                <span
                  className={clsx(
                    'rounded-pill px-1.5 text-xs font-bold',
                    activo ? 'bg-white/20 text-white' : 'bg-fondo-2 text-apagado',
                  )}
                >
                  {conteo(f.cuenta as string[])}
                </span>
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-apagado">
          <span className="sr-only sm:not-sr-only">Ordenar</span>
          <select
            value={orden}
            onChange={(e) => {
              setOrden(e.target.value as 'DESC' | 'ASC');
              setPagina(1);
            }}
            className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-4 py-2 text-sm font-semibold text-marino-700 outline-none focus:border-marino-600"
          >
            <option value="DESC">Más recientes</option>
            <option value="ASC">Más antiguos</option>
          </select>
        </label>
      </div>

      <EstadoVista
        cargando={isPending}
        error={isError}
        alReintentar={() => void refetch()}
        esqueleto={
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="esqueleto h-40 w-full rounded-20" />
            ))}
          </div>
        }
      >
        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-20 border border-borde bg-white px-6 py-14 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-16 bg-degradado-acento text-marino-900 shadow-acento">
              <IconoBolsa className="h-8 w-8" />
            </span>
            <h3 className="text-lg font-bold text-marino-900">
              {sinNingunPedido ? 'Aún no tienes pedidos' : 'Sin pedidos con ese filtro'}
            </h3>
            <p className="max-w-sm text-sm text-apagado">
              {sinNingunPedido
                ? 'Cuando compres, tus pedidos aparecerán aquí para que les des seguimiento.'
                : 'Prueba con otro estado o quita la búsqueda por número.'}
            </p>
            {sinNingunPedido ? (
              <Link to="/catalogo" className="inline-flex">
                <Boton variante="primario">Explorar el catálogo</Boton>
              </Link>
            ) : (
              <Boton
                variante="fantasma"
                onClick={() => {
                  setFiltroEstado('todos');
                  setBusqueda('');
                }}
              >
                Quitar filtros
              </Boton>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {pedidos.map((p) => (
                <TarjetaPedido
                  key={p.IDPedido}
                  pedido={p}
                  cancelando={cancelar.isPending && aCancelar?.IDPedido === p.IDPedido}
                  comprando={comprar.isPending && comprandoId === p.IDPedido}
                  onCancelar={setACancelar}
                  onComprarDeNuevo={comprarDeNuevo}
                />
              ))}
            </div>
            <Paginacion
              pagina={pagina}
              tamanoPagina={tamano}
              total={total}
              onPagina={setPagina}
              onTamano={(t) => {
                setTamano(t);
                setPagina(1);
              }}
            />
          </>
        )}
      </EstadoVista>

      <ModalCancelar
        abierto={aCancelar !== null}
        numero={aCancelar?.NumeroPedido ?? ''}
        cargando={cancelar.isPending}
        onConfirmar={confirmarCancelacion}
        onCancelar={() => setACancelar(null)}
      />
    </div>
  );
}
