import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import {
  useAplicarCupon,
  useActualizarItem,
  useCarrito,
  useQuitarCupon,
  useQuitarItem,
  useVaciarCarrito,
} from '../lib/consultas';
import { ErrorApi } from '../api/clienteHttp';
import { Boton } from '../componentes/ui/Boton';
import { Modal } from '../componentes/ui/Modal';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { Campo } from '../componentes/ui/Campo';
import { formatearQuetzales } from '../componentes/ui/Precio';
import {
  IconoAlerta,
  IconoBasura,
  IconoBolsa,
  IconoCerrar,
  IconoFlechaIzquierda,
  IconoMas,
  IconoMenos,
} from '../componentes/iconos';
import type { CuponCarrito, LineaCarrito } from '../api/tipos';

const LIMITE_CANTIDAD = 1000;

export default function Carrito() {
  const { usuario } = useAuth();
  const esCliente = usuario?.rol === 'Cliente';
  const navigate = useNavigate();

  const { data, isPending, isError, refetch } = useCarrito();
  const vaciar = useVaciarCarrito();
  const [modalVaciar, setModalVaciar] = useState(false);
  const [fusion, setFusion] = useState<{ lineas: number; advertencias: number } | null>(null);

  const totales = data?.carrito?.totales;
  const lineas = data?.lineas ?? [];
  const cupon = data?.cupon ?? null;
  const vacio = !isPending && !isError && lineas.length === 0;
  // El checkout se bloquea mientras haya lineas con advertencia o variante inactiva.
  const hayProblemas = lineas.some((l) => l.Advertencia !== null || !l.VarianteActiva);

  useEffect(() => {
    document.title = 'Carrito · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, []);

  // Aviso de fusion: se lee de sessionStorage una vez y se borra al mostrarlo.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('shopcart.fusion');
      if (raw) {
        setFusion(JSON.parse(raw) as { lineas: number; advertencias: number });
        sessionStorage.removeItem('shopcart.fusion');
      }
    } catch {
      /* sin sessionStorage: no se muestra el aviso */
    }
  }, []);

  const irAPagar = () => {
    if (hayProblemas) return;
    navigate(esCliente ? '/checkout' : '/login?volver=/checkout');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 lg:pb-10">
      {/* Migas */}
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-apagado">
        <Link to="/" className="hover:text-marino-700">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-marino-900">Carrito</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-apretado text-marino-900 sm:text-[40px]">
            Tu carrito
          </h1>
          {!vacio && totales && (
            <p className="mt-1 text-sm text-apagado">
              {totales.CantidadLineas} {totales.CantidadLineas === 1 ? 'producto' : 'productos'} ·{' '}
              {totales.CantidadUnidades} {totales.CantidadUnidades === 1 ? 'unidad' : 'unidades'} · los
              precios se confirman al pagar
            </p>
          )}
        </div>
        <Link
          to="/catalogo"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-marino-700 hover:text-marino-600"
        >
          <IconoFlechaIzquierda className="h-4 w-4" />
          Seguir comprando
        </Link>
      </div>

      {/* Aviso de fusion (una sola vez) */}
      {fusion && (
        <div className="mb-6 flex items-start gap-3 rounded-16 border border-marino-600/20 bg-marino-600/10 px-4 py-3 text-sm text-marino-700">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1 font-medium">
            Unimos tu carrito de invitado con tu cuenta.
            {fusion.advertencias > 0 &&
              ` ${fusion.advertencias} ${
                fusion.advertencias === 1 ? 'línea se ajustó' : 'líneas se ajustaron'
              } a la existencia disponible.`}
          </p>
          <button
            type="button"
            onClick={() => setFusion(null)}
            aria-label="Cerrar aviso"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-pill text-marino-700 hover:bg-marino-600/10"
          >
            <IconoCerrar className="h-4 w-4" />
          </button>
        </div>
      )}

      <EstadoVista
        cargando={isPending}
        error={isError}
        vacio={vacio}
        alReintentar={() => void refetch()}
        esqueleto={<EsqueletoCarrito />}
        tituloVacio="Tu carrito está vacío"
        textoVacio="Empieza por las ofertas de la semana o busca lo que tu motor necesita."
        accionVacio={
          <Link to="/#ofertas" className="inline-flex">
            <Boton>Ver ofertas</Boton>
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Lineas */}
          <section>
            <div className="rounded-20 border border-borde bg-white p-4 shadow-suave sm:p-5">
              <ul className="divide-y divide-borde">
                {lineas.map((l) => (
                  <FilaCarrito key={l.IDVariante} linea={l} />
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-borde pt-4">
                <button
                  type="button"
                  onClick={() => setModalVaciar(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-error-texto hover:underline"
                >
                  <IconoBasura className="h-4 w-4" />
                  Vaciar carrito
                </button>
                <span className="text-right text-xs text-apagado">
                  Límite: 50 líneas · 1000 unidades por línea
                </span>
              </div>
            </div>
          </section>

          {/* Resumen */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
              <h2 className="mb-4 text-lg font-extrabold tracking-apretado text-marino-900">Resumen</h2>
              <CajaCupon esCliente={esCliente} cupon={cupon} />
              {totales && (
                <dl className="mt-5 flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-apagado">Subtotal</dt>
                    <dd className="font-semibold text-marino-900">
                      {formatearQuetzales(totales.Subtotal)}
                    </dd>
                  </div>
                  {totales.Descuento > 0 && (
                    <div className="flex justify-between text-exito-texto">
                      <dt className="font-semibold">Descuento{cupon ? ` ${cupon.Codigo}` : ''}</dt>
                      <dd className="font-bold">−{formatearQuetzales(totales.Descuento)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-apagado">Envío</dt>
                    <dd className="text-apagado">se calcula en el checkout</dd>
                  </div>
                  <p className="text-xs text-apagado">
                    IVA {totales.PorcentajeIVA}% incluido: {formatearQuetzales(totales.IVA)}
                  </p>
                  <div className="my-1 border-t border-borde" />
                  <div className="flex items-baseline justify-between">
                    <dt className="text-base font-extrabold text-marino-900">Total</dt>
                    <dd className="text-[28px] font-extrabold tracking-apretado text-marino-900">
                      {formatearQuetzales(totales.Total)}
                    </dd>
                  </div>
                </dl>
              )}

              <Boton onClick={irAPagar} disabled={hayProblemas} className="mt-5 w-full">
                Ir a pagar
              </Boton>
              {hayProblemas && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-advertencia-texto">
                  <IconoAlerta className="h-3.5 w-3.5 shrink-0" />
                  Revisa las líneas marcadas
                </p>
              )}
              <p className="mt-2 text-xs text-apagado">
                Al iniciar el pago reservamos tu existencia por 15 minutos.
              </p>
            </div>
          </aside>
        </div>

        {/* Barra fija inferior (movil): encima de la BarraInferiorMovil */}
        {totales && (
          <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-borde bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <div className="leading-tight">
                <span className="block text-xs text-apagado">Total</span>
                <span className="block text-lg font-extrabold text-marino-900">
                  {formatearQuetzales(totales.Total)}
                </span>
              </div>
              <Boton onClick={irAPagar} disabled={hayProblemas}>
                Ir a pagar
              </Boton>
            </div>
          </div>
        )}
      </EstadoVista>

      <Modal
        abierto={modalVaciar}
        titulo="¿Vaciar el carrito?"
        textoConfirmar="Vaciar"
        varianteConfirmar="peligro"
        cargando={vaciar.isPending}
        alConfirmar={() => vaciar.mutate(undefined, { onSuccess: () => setModalVaciar(false) })}
        alCancelar={() => setModalVaciar(false)}
      >
        Se quitarán todas las líneas de tu carrito. Esta acción no se puede deshacer.
      </Modal>
    </div>
  );
}

/* ------------------------------- Linea ----------------------------------- */

function FilaCarrito({ linea }: { linea: LineaCarrito }) {
  const actualizar = useActualizarItem();
  const quitar = useQuitarItem();
  const [cantidad, setCantidad] = useState(linea.Cantidad);
  const cantidadRef = useRef(linea.Cantidad);
  const timer = useRef<number>();

  const inactiva = !linea.VarianteActiva;
  const bloqueada = actualizar.isPending || quitar.isPending;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Varios clics en +/- se acumulan localmente (el numero cambia al instante) y, tras
  // 400 ms sin clics, se envia UN solo PUT con el valor final. Los totales no se tocan
  // aqui: se esperan de la respuesta de la API (via invalidacion de ['carrito']).
  const ajustar = (delta: number) => {
    const nueva = Math.min(LIMITE_CANTIDAD, Math.max(1, cantidadRef.current + delta));
    if (nueva === cantidadRef.current) return;
    cantidadRef.current = nueva;
    setCantidad(nueva);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      actualizar.mutate(
        { idVariante: linea.IDVariante, cantidad: nueva },
        {
          onError: () => {
            // La API rechazo el cambio (p. ej. 409 de existencia): vuelve al valor real.
            cantidadRef.current = linea.Cantidad;
            setCantidad(linea.Cantidad);
          },
        },
      );
    }, 400);
  };

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
      {/* Foto */}
      <Link
        to={`/producto/${linea.IDProducto}`}
        className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-16 bg-fondo-2"
        aria-label={linea.Producto}
      >
        {linea.ImagenPrincipal ? (
          <img
            src={linea.ImagenPrincipal}
            alt={linea.Producto}
            loading="lazy"
            className={inactiva ? 'h-full w-full object-cover opacity-60 grayscale' : 'h-full w-full object-cover'}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-degradado-marino text-white/40">
            <IconoBolsa className="h-8 w-8" />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-ancho text-apagado">
          {linea.Categoria}
        </span>
        <Link
          to={`/producto/${linea.IDProducto}`}
          className="block truncate text-sm font-bold text-marino-900 hover:text-marino-700"
        >
          {linea.Producto}
        </Link>
        <p className="text-xs text-apagado">SKU {linea.SKU}</p>
        <p className="mt-0.5 text-sm font-semibold text-marino-700">
          {formatearQuetzales(linea.PrecioUnitario)} c/u
        </p>
        {inactiva ? (
          <span className="mt-2 inline-flex rounded-pill bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold text-[#475569]">
            {linea.Advertencia ?? 'No disponible para la venta'}
          </span>
        ) : linea.Advertencia ? (
          <span className="mt-2 inline-flex rounded-pill bg-[#FFF7ED] px-2.5 py-1 text-xs font-semibold text-[#B45309]">
            {linea.Advertencia} · disponibles {linea.Disponible}
          </span>
        ) : null}
      </div>

      {/* Cantidad + total + quitar */}
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
        <span className="order-2 text-base font-extrabold text-marino-900 sm:order-1">
          {formatearQuetzales(linea.TotalLinea)}
        </span>
        <div className="order-1 flex items-center gap-2 sm:order-2">
          <div className="flex items-center rounded-pill border border-[rgba(15,23,42,.14)] bg-white">
            <button
              type="button"
              onClick={() => ajustar(-1)}
              disabled={cantidad <= 1 || bloqueada || inactiva}
              aria-label="Disminuir cantidad"
              className="grid h-9 w-9 place-items-center rounded-pill text-marino-700 disabled:opacity-40"
            >
              <IconoMenos className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-sm font-bold text-marino-900" aria-live="polite">
              {cantidad}
            </span>
            <button
              type="button"
              onClick={() => ajustar(1)}
              disabled={cantidad >= LIMITE_CANTIDAD || bloqueada || inactiva}
              aria-label="Aumentar cantidad"
              className="grid h-9 w-9 place-items-center rounded-pill text-marino-700 disabled:opacity-40"
            >
              <IconoMas className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => quitar.mutate(linea.IDVariante)}
            disabled={bloqueada}
            aria-label={`Quitar ${linea.Producto}`}
            className="grid h-9 w-9 place-items-center rounded-pill text-apagado hover:bg-fondo-2 hover:text-error-texto disabled:opacity-40"
          >
            <IconoBasura className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------- Cupon ----------------------------------- */

function textoCupon(c: CuponCarrito): string {
  const ahorro = `ahorras ${formatearQuetzales(c.descuento.descuento)}`;
  if (c.TipoDescuento === 'PORCENTAJE') {
    return `${c.Valor} % en ${c.Categoria ?? 'toda la tienda'} · ${ahorro}`;
  }
  return `${formatearQuetzales(c.Valor)} de descuento · ${ahorro}`;
}

function CajaCupon({ esCliente, cupon }: { esCliente: boolean; cupon: CuponCarrito | null }) {
  const aplicar = useAplicarCupon();
  const quitar = useQuitarCupon();
  const [codigo, setCodigo] = useState('');
  const [errorInline, setErrorInline] = useState<string | null>(null);

  // Invitado: no puede usar cupones (la API exige sesion de Cliente).
  if (!esCliente) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-texto">Cupón</span>
        <input
          disabled
          placeholder="Inicia sesión para usar cupones"
          aria-label="Cupón (requiere iniciar sesión)"
          className="w-full cursor-not-allowed rounded-12 border border-[rgba(15,23,42,.14)] bg-fondo-2 px-3.5 py-2.5 text-sm text-apagado placeholder:text-apagado"
        />
        <Link
          to="/login?volver=/carrito"
          className="text-xs font-semibold text-marino-700 hover:text-marino-600"
        >
          Inicia sesión para usar cupones
        </Link>
      </div>
    );
  }

  // Cliente con cupon aplicado: verde si valido, ámbar si no (con la causa de la API).
  if (cupon) {
    const valido = cupon.descuento.valido;
    return (
      <div
        className={
          valido
            ? 'rounded-16 border border-exito/30 bg-exito/10 p-3'
            : 'rounded-16 border border-[#B45309]/30 bg-[#FFF7ED] p-3'
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <code
              className={`font-mono text-sm font-bold ${valido ? 'text-exito-texto' : 'text-[#B45309]'}`}
            >
              {cupon.Codigo}
            </code>
            <p className={valido ? 'mt-1 text-xs text-exito-texto' : 'mt-1 text-xs text-[#B45309]'}>
              {valido ? textoCupon(cupon) : cupon.descuento.causa}
            </p>
          </div>
          <button
            type="button"
            onClick={() => quitar.mutate()}
            disabled={quitar.isPending}
            className="shrink-0 text-xs font-semibold text-marino-700 underline hover:text-marino-600 disabled:opacity-40"
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  // Cliente sin cupon: campo + Aplicar.
  const onAplicar = () => {
    const c = codigo.trim();
    if (!c) return;
    setErrorInline(null);
    aplicar.mutate(c, {
      onSuccess: () => setCodigo(''),
      onError: (err) =>
        setErrorInline(err instanceof ErrorApi ? err.mensaje : 'No se pudo aplicar el cupón'),
    });
  };

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Campo
            label="Cupón"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 30))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAplicar();
              }
            }}
            placeholder="Ej. ADIT15"
            maxLength={30}
            autoCapitalize="characters"
            error={errorInline ?? undefined}
          />
        </div>
        <Boton
          variante="secundario"
          onClick={onAplicar}
          cargando={aplicar.isPending}
          className="mb-[2px]"
        >
          Aplicar
        </Boton>
      </div>
    </div>
  );
}

/* ----------------------------- Esqueleto --------------------------------- */

function EsqueletoCarrito() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 border-b border-borde py-4 last:border-0">
            <div className="esqueleto h-20 w-20 shrink-0 rounded-16" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="esqueleto h-3 w-20 rounded-pill" />
              <div className="esqueleto h-4 w-2/3 rounded-pill" />
              <div className="esqueleto h-4 w-24 rounded-pill" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-20 border border-borde bg-white p-5 shadow-suave">
        <div className="esqueleto h-6 w-28 rounded-pill" />
        <div className="esqueleto mt-4 h-11 w-full rounded-12" />
        <div className="esqueleto mt-5 h-20 w-full rounded-12" />
        <div className="esqueleto mt-5 h-12 w-full rounded-pill" />
      </div>
    </div>
  );
}
