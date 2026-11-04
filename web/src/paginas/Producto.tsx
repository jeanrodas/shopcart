import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  useAgregarAlCarrito,
  useBuscarProductos,
  useCuponesVigentes,
  useDestacados,
  useProducto,
} from '../lib/consultas';
import { cuponPorcentajeDeCategoria } from '../lib/cupones';
import { ErrorApi } from '../api/clienteHttp';
import { Boton } from '../componentes/ui/Boton';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { TarjetaProducto } from '../componentes/ui/TarjetaProducto';
import { formatearQuetzales } from '../componentes/ui/Precio';
import { useToast } from '../componentes/ui/Toast';
import {
  IconoBolsa,
  IconoCamion,
  IconoCopiar,
  IconoDevolucion,
  IconoEscudo,
  IconoMas,
  IconoMenos,
} from '../componentes/iconos';
import type { Variante } from '../api/tipos';

const MAX_CANTIDAD = 1000;

/** Nombre compuesto de una variante a partir de sus atributos ("5W-30 · 1 Cuarto"). */
function nombreVariante(v: Variante): string {
  return v.atributos.length > 0 ? v.atributos.map((a) => a.Valor).join(' · ') : v.SKU;
}

function Disponibilidad({ disponible }: { disponible: number }) {
  if (disponible <= 0) {
    return <Punto tono="gris">Sin existencia</Punto>;
  }
  if (disponible <= 10) {
    return <Punto tono="ambar">Quedan {disponible} unidades</Punto>;
  }
  return <Punto tono="verde">Disponible</Punto>;
}

function Punto({ tono, children }: { tono: 'verde' | 'ambar' | 'gris'; children: React.ReactNode }) {
  const texto = { verde: 'text-exito-texto', ambar: 'text-advertencia-texto', gris: 'text-apagado' }[tono];
  const punto = { verde: 'bg-exito', ambar: 'bg-advertencia', gris: 'bg-apagado' }[tono];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-sm font-semibold', texto)}>
      <span className={clsx('h-2 w-2 rounded-pill', punto)} />
      {children}
    </span>
  );
}

export default function Producto() {
  const { id } = useParams();
  const idProducto = Number(id);
  const [sp] = useSearchParams();
  const cuponUrl = sp.get('cupon');
  const varianteUrl = sp.get('variante');

  const { data, isPending, error, isError, refetch } = useProducto(idProducto);
  const { data: destacados } = useDestacados();
  const { data: cuponesData } = useCuponesVigentes();
  const cupones = cuponesData?.cupones;

  const cantidadRef = useRef<HTMLInputElement>(null);
  // Tras un alta exitosa, el boton se pone verde "Agregado ✓" por 1.5 s (y sigue deshabilitado).
  const [exito, setExito] = useState(false);
  const exitoTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(exitoTimer.current), []);
  const agregar = useAgregarAlCarrito({
    accionExito: { texto: 'Ver carrito', a: '/carrito' },
    alExito: () => {
      setExito(true);
      window.clearTimeout(exitoTimer.current);
      exitoTimer.current = window.setTimeout(() => setExito(false), 1500);
    },
    alError: () => cantidadRef.current?.focus(),
  });

  const [skuSel, setSkuSel] = useState<string | null>(null);
  const [imagenSel, setImagenSel] = useState(0);
  const [cantidad, setCantidad] = useState(1);

  const producto = data?.producto;
  const variantes = (data?.variantes ?? []).filter((v) => v.Activo);
  const imagenes = data?.imagenes ?? [];

  // Seleccion inicial de variante: ?variante=SKU, o la primera disponible, o la primera.
  useEffect(() => {
    if (variantes.length === 0) {
      setSkuSel(null);
      return;
    }
    const porUrl = varianteUrl ? variantes.find((v) => v.SKU === varianteUrl) : undefined;
    const inicial = porUrl ?? variantes.find((v) => v.Disponible > 0) ?? variantes[0]!;
    setSkuSel(inicial.SKU);
    setImagenSel(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, varianteUrl]);

  useEffect(() => {
    document.title = producto ? `${producto.Nombre} · ShopCart` : 'ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, [producto]);

  const seleccionada = variantes.find((v) => v.SKU === skuSel) ?? null;

  // La cantidad se mantiene dentro de 1..min(Disponible, 1000) al cambiar de variante.
  const topeCantidad = seleccionada ? Math.min(seleccionada.Disponible, MAX_CANTIDAD) : 1;
  useEffect(() => {
    setCantidad((c) => Math.min(Math.max(1, c), Math.max(1, topeCantidad)));
  }, [skuSel, topeCantidad]);

  const es404 = isError && error instanceof ErrorApi && error.status === 404;

  // Productos relacionados (misma categoria), excluyendo el actual.
  const { data: relacionadosData } = useBuscarProductos(
    producto ? { idCategoria: producto.IDCategoria, tamanoPagina: 5, pagina: 1 } : { tamanoPagina: 5 },
  );
  const relacionados = (relacionadosData?.filas ?? [])
    .filter((p) => p.IDProducto !== idProducto)
    .slice(0, 4);

  const cuponPct = producto ? cuponPorcentajeDeCategoria(cupones, producto.IDCategoria) : undefined;
  const cuponMonto = producto
    ? cupones?.find(
        (c) => c.IDCategoria === producto.IDCategoria && c.TipoDescuento === 'MONTO',
      )
    : undefined;
  const posicionVendido = destacados?.masVendidos.find((m) => m.IDProducto === idProducto)?.Posicion;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <EstadoVista
        cargando={isPending}
        error={isError && !es404}
        vacio={es404}
        alReintentar={() => void refetch()}
        esqueleto={<EsqueletoDetalle />}
        tituloVacio="Este producto no está disponible"
        textoVacio="Puede que ya no esté en el catálogo."
        accionVacio={
          <Link to="/catalogo" className="inline-flex">
            <Boton variante="secundario">Ver catálogo</Boton>
          </Link>
        }
      >
        {producto && (
          <>
            {/* Franja de cupon recordado desde el Inicio */}
            {cuponUrl && <FranjaCupon codigo={cuponUrl} />}

            {/* Migas */}
            <nav aria-label="Migas de pan" className="mb-5 text-sm text-apagado">
              <Link to="/" className="hover:text-marino-700">
                Inicio
              </Link>
              <span className="mx-2">/</span>
              <Link to="/catalogo" className="hover:text-marino-700">
                Catálogo
              </Link>
              <span className="mx-2">/</span>
              <Link to={`/catalogo?idCategoria=${producto.IDCategoria}`} className="hover:text-marino-700">
                {producto.Categoria}
              </Link>
              <span className="mx-2">/</span>
              <span className="font-semibold text-marino-900">{producto.Nombre}</span>
            </nav>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Columna izquierda: imagenes */}
              <div>
                <div className="relative aspect-square overflow-hidden rounded-[24px] bg-fondo-2 shadow-elevada">
                  {imagenes.length > 0 ? (
                    <img
                      src={imagenes[imagenSel]?.Url}
                      alt={producto.Nombre}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-degradado-marino text-white/40">
                      <IconoBolsa className="h-20 w-20" />
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex flex-col gap-2">
                    {cuponPct && (
                      <span className="rounded-pill bg-degradado-acento px-3 py-1 text-xs font-extrabold text-marino-900 shadow-acento">
                        -{cuponPct.Valor} % con cupón {cuponPct.Codigo}
                      </span>
                    )}
                    {posicionVendido !== undefined && (
                      <span className="w-fit rounded-pill bg-marino-900/90 px-3 py-1 text-xs font-extrabold text-white">
                        #{posicionVendido} más vendido
                      </span>
                    )}
                  </div>
                </div>

                {imagenes.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {imagenes.map((img, i) => (
                      <button
                        key={img.IDProductoImagen}
                        type="button"
                        onClick={() => setImagenSel(i)}
                        aria-label={`Imagen ${i + 1}`}
                        className={clsx(
                          'h-[84px] w-[84px] overflow-hidden rounded-16 border-2',
                          i === imagenSel ? 'border-naranja' : 'border-transparent',
                        )}
                      >
                        <img src={img.Url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Columna derecha: informacion */}
              <div className="flex flex-col gap-4">
                <p className="text-xs font-extrabold uppercase tracking-ancho text-naranja-600">
                  {producto.Categoria}
                </p>
                <h1 className="text-[32px] font-extrabold leading-tight tracking-apretado text-marino-900 sm:text-[40px]">
                  {producto.Nombre}
                </h1>
                {producto.Descripcion && <p className="text-sm text-apagado">{producto.Descripcion}</p>}

                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[32px] font-extrabold text-marino-900 sm:text-[36px]">
                      {formatearQuetzales(seleccionada?.Precio)}
                    </span>
                    <span className="text-sm text-apagado">IVA incluido</span>
                  </div>
                  {cuponPct && (
                    <p className="mt-1 text-sm font-semibold text-naranja-700">
                      con el cupón {cuponPct.Codigo} ahorras {cuponPct.Valor} %
                    </p>
                  )}
                  {cuponMonto && (
                    <p className="mt-1 text-sm font-semibold text-naranja-700">
                      {formatearQuetzales(cuponMonto.Valor)} de descuento con {cuponMonto.Codigo}
                      {cuponMonto.MontoMinimo > 0 &&
                        ` en compras desde ${formatearQuetzales(cuponMonto.MontoMinimo)}`}
                    </p>
                  )}
                </div>

                {/* Selector de presentacion (variantes) */}
                {variantes.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-extrabold text-marino-900">Presentación</p>
                    <div className="flex flex-wrap gap-2">
                      {variantes.map((v) => {
                        const activa = v.SKU === skuSel;
                        return (
                          <button
                            key={v.IDVariante}
                            type="button"
                            onClick={() => setSkuSel(v.SKU)}
                            aria-pressed={activa}
                            className={clsx(
                              'rounded-16 border px-3 py-2 text-left text-sm transition-colors',
                              activa
                                ? 'border-marino-700 bg-marino-700 text-white'
                                : 'border-[rgba(15,23,42,.14)] bg-white text-texto hover:border-marino-600',
                            )}
                          >
                            <span className="block font-bold">{nombreVariante(v)}</span>
                            <span className={clsx('block text-xs', activa ? 'text-white/80' : 'text-apagado')}>
                              {formatearQuetzales(v.Precio)} ·{' '}
                              {v.Disponible <= 0
                                ? 'Sin existencia'
                                : v.Disponible <= 10
                                  ? `Quedan ${v.Disponible}`
                                  : 'Disponible'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {seleccionada && (
                  <>
                    <Disponibilidad disponible={seleccionada.Disponible} />

                    {/* Cantidad + agregar */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center rounded-pill border border-[rgba(15,23,42,.14)] bg-white">
                        <button
                          type="button"
                          onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                          disabled={cantidad <= 1 || seleccionada.Disponible <= 0}
                          aria-label="Disminuir cantidad"
                          className="grid h-11 w-11 place-items-center rounded-pill text-marino-700 disabled:opacity-40"
                        >
                          <IconoMenos className="h-4 w-4" />
                        </button>
                        <input
                          ref={cantidadRef}
                          type="number"
                          min={1}
                          max={topeCantidad}
                          value={cantidad}
                          onChange={(e) => {
                            const n = Math.trunc(Number(e.target.value));
                            if (!Number.isFinite(n)) return;
                            setCantidad(Math.min(Math.max(1, n), Math.max(1, topeCantidad)));
                          }}
                          aria-label="Cantidad"
                          className="w-14 bg-transparent text-center text-sm font-bold text-marino-900 outline-none [appearance:textfield]"
                        />
                        <button
                          type="button"
                          onClick={() => setCantidad((c) => Math.min(topeCantidad, c + 1))}
                          disabled={cantidad >= topeCantidad || seleccionada.Disponible <= 0}
                          aria-label="Aumentar cantidad"
                          className="grid h-11 w-11 place-items-center rounded-pill text-marino-700 disabled:opacity-40"
                        >
                          <IconoMas className="h-4 w-4" />
                        </button>
                      </div>

                      <Boton
                        className={clsx(
                          'flex-1',
                          exito && '!bg-none !bg-[#16A34A] !text-white !opacity-100',
                        )}
                        disabled={seleccionada.Disponible <= 0 || exito}
                        cargando={agregar.isPending}
                        onClick={() =>
                          agregar.mutate({ idVariante: seleccionada.IDVariante, cantidad })
                        }
                      >
                        {exito
                          ? 'Agregado ✓'
                          : seleccionada.Disponible <= 0
                            ? 'Sin existencia'
                            : 'Agregar al carrito'}
                      </Boton>
                    </div>

                    {/* Atributos de la variante */}
                    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 rounded-16 border border-borde bg-white p-4 text-sm">
                      {seleccionada.atributos.map((a) => (
                        <div key={a.Nombre} className="flex justify-between gap-2">
                          <dt className="text-apagado">{a.Nombre}</dt>
                          <dd className="font-semibold text-marino-900">{a.Valor}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-2">
                        <dt className="text-apagado">SKU</dt>
                        <dd className="font-semibold text-marino-900">{seleccionada.SKU}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-apagado">Categoría</dt>
                        <dd className="font-semibold text-marino-900">{producto.Categoria}</dd>
                      </div>
                    </dl>

                    {/* Fila de confianza */}
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-apagado">
                      <span className="inline-flex items-center gap-1.5">
                        <IconoCamion className="h-4 w-4 text-marino-600" /> Entrega en 24 h
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconoEscudo className="h-4 w-4 text-marino-600" /> Pago seguro
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <IconoDevolucion className="h-4 w-4 text-marino-600" /> Devolución por línea
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Tambien te puede interesar */}
            {relacionados.length > 0 && (
              <section className="mt-14">
                <h2 className="mb-5 text-[24px] font-extrabold tracking-apretado text-marino-900">
                  También te puede interesar
                </h2>
                <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
                  {relacionados.map((p) => (
                    <TarjetaProducto
                      key={p.IDProducto}
                      producto={p}
                      enlace={`/producto/${p.IDProducto}`}
                      insignia={
                        cuponPorcentajeDeCategoria(cupones, p.IDCategoria)
                          ? `-${cuponPorcentajeDeCategoria(cupones, p.IDCategoria)!.Valor} % con ${
                              cuponPorcentajeDeCategoria(cupones, p.IDCategoria)!.Codigo
                            }`
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </EstadoVista>
    </div>
  );
}

function FranjaCupon({ codigo }: { codigo: string }) {
  const { mostrar } = useToast();
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      mostrar('Cupón copiado', 'exito');
    } catch {
      mostrar('No se pudo copiar el cupón', 'error');
    }
  };
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-16 bg-degradado-marino px-4 py-3 text-white shadow-marino">
      <p className="text-sm font-semibold">
        Recuerda aplicar el cupón <span className="font-mono font-bold text-dorado">{codigo}</span> en tu
        carrito
      </p>
      <button
        type="button"
        onClick={() => void copiar()}
        className="inline-flex min-h-[36px] items-center gap-2 rounded-pill bg-white px-3 text-sm font-bold text-marino-900 hover:bg-white/90"
      >
        <IconoCopiar className="h-4 w-4" />
        Copiar
      </button>
    </div>
  );
}

function EsqueletoDetalle() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="esqueleto aspect-square w-full rounded-[24px]" />
      <div className="flex flex-col gap-4">
        <div className="esqueleto h-4 w-24 rounded-pill" />
        <div className="esqueleto h-10 w-3/4 rounded-pill" />
        <div className="esqueleto h-20 w-full rounded-16" />
        <div className="esqueleto h-9 w-1/3 rounded-pill" />
        <div className="esqueleto h-12 w-full rounded-pill" />
      </div>
    </div>
  );
}
