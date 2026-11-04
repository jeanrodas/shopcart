import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useBuscarProductos, useCategorias, useCuponesVigentes } from '../lib/consultas';
import {
  cuponDeCategoria,
  cuponGeneral,
  cuponPorcentajeDeCategoria,
  textoInsigniaCupon,
} from '../lib/cupones';
import { Boton } from '../componentes/ui/Boton';
import { Chip } from '../componentes/ui/Chip';
import { EstadoVista, TarjetaEsqueleto } from '../componentes/ui/EstadoVista';
import { TarjetaProducto } from '../componentes/ui/TarjetaProducto';
import { formatearQuetzales } from '../componentes/ui/Precio';
import { IconoBuscar, IconoFiltro } from '../componentes/iconos';
import {
  aParams,
  claveOrden,
  contarActivos,
  escribirFiltros,
  leerFiltros,
  OPCIONES_ORDEN,
  type EstadoFiltros,
} from './catalogo/estado';
import { Filtros } from './catalogo/Filtros';
import { HojaInferior } from './catalogo/HojaInferior';
import { Paginacion } from './catalogo/Paginacion';
import { CuponCard } from './catalogo/CuponCard';

const GRID = 'grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3';

export default function Catalogo() {
  const [sp, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filtros = leerFiltros(sp);

  const { data, isPending, isError, refetch } = useBuscarProductos(aParams(filtros));
  const { data: categorias } = useCategorias();
  const { data: cuponesData } = useCuponesVigentes();
  const cupones = cuponesData?.cupones;

  const [hojaAbierta, setHojaAbierta] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const total = data?.total ?? 0;
  const productos = data?.filas ?? [];

  // <title> del documento.
  useEffect(() => {
    document.title = filtros.texto ? `Resultados para ${filtros.texto} · ShopCart` : 'Catálogo · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, [filtros.texto]);

  // Si la pagina solicitada supera el total (p. ej. tras filtrar), vuelve a 1.
  useEffect(() => {
    if (data && filtros.pagina > 1 && total <= (filtros.pagina - 1) * filtros.tamanoPagina) {
      aplicar({ pagina: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filtros.pagina, filtros.tamanoPagina, total]);

  /** Aplica cambios a los filtros en la URL. Cualquier cambio que no sea de pagina la reinicia a 1. */
  function aplicar(cambios: Partial<EstadoFiltros>) {
    const nuevos: EstadoFiltros = { ...filtros, ...cambios };
    if (cambios.pagina === undefined) nuevos.pagina = 1;
    setSearchParams(escribirFiltros(nuevos), { replace: false });
  }

  function cambiarPagina(pagina: number) {
    aplicar({ pagina });
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const [textoMovil, setTextoMovil] = useState(filtros.texto ?? '');
  useEffect(() => setTextoMovil(filtros.texto ?? ''), [filtros.texto]);
  const buscarMovil = (e: FormEvent) => {
    e.preventDefault();
    aplicar({ texto: textoMovil.trim() || undefined });
  };

  const nombreCategoria = categorias?.find((c) => c.IDCategoria === filtros.idCategoria)?.Nombre;
  const activos = contarActivos(filtros);

  // Cupon de la tarjeta lateral: el de la categoria seleccionada, o el general.
  const cuponPanel = filtros.idCategoria
    ? cuponDeCategoria(cupones, filtros.idCategoria)
    : cuponGeneral(cupones);

  const panelFiltros = (modo: 'panel' | 'hoja') => (
    <Filtros
      categorias={categorias ?? []}
      filtros={filtros}
      cuponCard={<CuponCard cupon={cuponPanel} />}
      instantaneo={modo === 'panel'}
      total={total}
      onAplicar={aplicar}
      onCerrar={() => setHojaAbierta(false)}
    />
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Migas */}
      <nav aria-label="Migas de pan" className="mb-4 text-sm text-apagado">
        <Link to="/" className="hover:text-marino-700">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-marino-900">Catálogo</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-apretado text-marino-900 sm:text-[40px]">
            Catálogo
          </h1>
          <p className="mt-1 text-sm text-apagado">
            {total} {total === 1 ? 'producto' : 'productos'}
            {filtros.texto && (
              <>
                {' '}
                · resultados para <span className="font-semibold text-marino-900">“{filtros.texto}”</span>
              </>
            )}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-apagado">
          Ordenar por
          <select
            value={claveOrden(filtros.orden, filtros.direccion)}
            onChange={(e) => {
              const opt = OPCIONES_ORDEN.find((o) => o.valor === e.target.value);
              if (opt) aplicar({ orden: opt.orden, direccion: opt.direccion });
            }}
            className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-4 py-2 text-sm font-semibold text-marino-700 outline-none focus:border-marino-600"
          >
            {OPCIONES_ORDEN.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Controles de movil: buscador + boton de filtros */}
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <form onSubmit={buscarMovil} role="search" className="flex-1">
          <div className="flex items-center gap-2 rounded-pill border border-borde bg-white px-4 py-2">
            <IconoBuscar className="h-4 w-4 text-apagado" />
            <input
              type="search"
              value={textoMovil}
              onChange={(e) => setTextoMovil(e.target.value)}
              placeholder="Buscar en el catálogo…"
              aria-label="Buscar productos"
              className="w-full bg-transparent text-sm text-texto outline-none placeholder:text-apagado"
            />
          </div>
        </form>
        <button
          type="button"
          onClick={() => setHojaAbierta(true)}
          aria-label={`Filtros${activos > 0 ? `, ${activos} activos` : ''}`}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-degradado-marino text-white shadow-marino"
        >
          <IconoFiltro className="h-5 w-5" />
          {activos > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill bg-degradado-acento px-1 text-[11px] font-extrabold text-marino-900">
              {activos}
            </span>
          )}
        </button>
      </div>

      {/* Chips de filtros activos */}
      {activos > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 sin-barra lg:flex-wrap lg:overflow-visible">
          {filtros.idCategoria !== undefined && (
            <Chip alQuitar={() => aplicar({ idCategoria: undefined })}>
              {nombreCategoria ?? 'Categoría'}
            </Chip>
          )}
          {filtros.precioMin !== undefined && (
            <Chip alQuitar={() => aplicar({ precioMin: undefined })}>
              Desde {formatearQuetzales(filtros.precioMin)}
            </Chip>
          )}
          {filtros.precioMax !== undefined && (
            <Chip alQuitar={() => aplicar({ precioMax: undefined })}>
              Hasta {formatearQuetzales(filtros.precioMax)}
            </Chip>
          )}
          {filtros.soloDisponibles && (
            <Chip alQuitar={() => aplicar({ soloDisponibles: false })}>Con existencia</Chip>
          )}
          {filtros.texto && (
            <Chip alQuitar={() => aplicar({ texto: undefined })}>“{filtros.texto}”</Chip>
          )}
          <button
            type="button"
            onClick={limpiarTodo}
            className="whitespace-nowrap text-xs font-semibold text-marino-700 underline hover:text-marino-600"
          >
            Limpiar todo
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Panel lateral (escritorio) */}
        <aside className="hidden w-[264px] shrink-0 lg:block">{panelFiltros('panel')}</aside>

        {/* Resultados */}
        <div className="min-w-0 flex-1" ref={gridRef}>
          <EstadoVista
            cargando={isPending}
            error={isError}
            vacio={!isPending && !isError && total === 0}
            alReintentar={() => void refetch()}
            esqueleto={
              <div className={GRID}>
                {Array.from({ length: filtros.tamanoPagina }).map((_, i) => (
                  <TarjetaEsqueleto key={i} />
                ))}
              </div>
            }
            tituloVacio="Sin resultados con esos filtros"
            textoVacio="Prueba quitando alguna categoría o ampliando el rango de precio."
            accionVacio={
              <Boton variante="fantasma" onClick={limpiarTodo}>
                Limpiar filtros
              </Boton>
            }
          >
            <div className={GRID}>
              {productos.map((p) => {
                const cuponPct = cuponPorcentajeDeCategoria(cupones, p.IDCategoria);
                const enlace = `/producto/${p.IDProducto}`;
                return (
                  <TarjetaProducto
                    key={p.IDProducto}
                    producto={p}
                    enlace={enlace}
                    insignia={cuponPct ? textoInsigniaCupon(cuponPct) : undefined}
                    alAgregar={p.HayDisponible ? () => navigate(enlace) : undefined}
                  />
                );
              })}
            </div>
            <Paginacion
              pagina={filtros.pagina}
              tamanoPagina={filtros.tamanoPagina}
              total={total}
              onPagina={cambiarPagina}
              onTamano={(t) => aplicar({ tamanoPagina: t })}
            />
          </EstadoVista>
        </div>
      </div>

      {hojaAbierta && (
        <HojaInferior titulo="Filtros" onCerrar={() => setHojaAbierta(false)}>
          {panelFiltros('hoja')}
        </HojaInferior>
      )}
    </div>
  );

  function limpiarTodo() {
    setSearchParams(
      escribirFiltros({
        ...filtros,
        texto: undefined,
        idCategoria: undefined,
        precioMin: undefined,
        precioMax: undefined,
        soloDisponibles: false,
        pagina: 1,
      }),
    );
  }
}
