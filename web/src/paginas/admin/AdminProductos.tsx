import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import { useCategoriasAdmin, useProductosAdmin } from '../../lib/consultas';
import { Boton } from '../../componentes/ui/Boton';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { useOrdenURL, ThOrden } from '../../componentes/ui/Orden';
import { Precio } from '../../componentes/ui/Precio';
import { resolverImagen } from '../../lib/imagenes';
import { Paginacion, TAMANOS_PAGINA_ADMIN } from '../catalogo/Paginacion';
import { PanelProducto } from './PanelProducto';
import type { ConteosCatalogo, EstadoDerivado, FiltrosAdmin, ProductoAdminFila } from '../../api/tipos';

type ClaveEstado = EstadoDerivado | 'bajoStock' | 'todos';

const CHIPS: { clave: ClaveEstado; texto: string; clases: string; conteo: keyof ConteosCatalogo | null }[] = [
  { clave: 'todos', texto: 'Todos', clases: 'bg-marino-600/10 text-marino-700', conteo: 'Total' },
  { clave: 'publicado', texto: 'Publicados', clases: 'bg-exito/10 text-exito-texto', conteo: 'Publicados' },
  { clave: 'agotado', texto: 'Agotados', clases: 'bg-error/10 text-error-texto', conteo: 'Agotados' },
  { clave: 'incompleto', texto: 'Incompletos', clases: 'bg-ambar/15 text-naranja-700', conteo: 'Incompletos' },
  { clave: 'oculto', texto: 'Ocultos', clases: 'bg-apagado/15 text-apagado', conteo: 'Ocultos' },
  { clave: 'bajoStock', texto: 'Bajo stock', clases: 'bg-ambar/15 text-naranja-700', conteo: 'BajoStock' },
];

const ESTADO_PILL: Record<EstadoDerivado, { texto: string; sub: string; punto: string; clases: string }> = {
  publicado: { texto: 'Publicado', sub: 'a la venta', punto: 'bg-exito', clases: 'bg-exito/10 text-exito-texto' },
  agotado: { texto: 'Agotado', sub: 'visible, sin compra', punto: 'bg-error', clases: 'bg-error/10 text-error-texto' },
  incompleto: { texto: 'Incompleto', sub: 'sin variante activa · no aparece', punto: 'bg-ambar', clases: 'bg-ambar/15 text-naranja-700' },
  oculto: { texto: 'Oculto', sub: 'inactivo · borrador', punto: 'bg-apagado', clases: 'bg-apagado/15 text-apagado' },
};

export default function AdminProductos() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'Administrador';
  const soloLectura = !esAdmin;

  const [texto, setTexto] = useState('');
  const [textoDeb, setTextoDeb] = useState('');
  const [idCategoria, setIdCategoria] = useState<number | ''>('');
  const [estado, setEstado] = useState<ClaveEstado>('todos');
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);
  const orden = useOrdenURL(['nombre', 'categoria', 'precio', 'disponible', 'estado'] as const, {
    orden: 'nombre',
    direccion: 'ASC',
  });

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [idEditar, setIdEditar] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Productos · Administración';
  }, []);

  // Debounce de la busqueda (300 ms).
  useEffect(() => {
    const t = window.setTimeout(() => setTextoDeb(texto.trim()), 300);
    return () => window.clearTimeout(t);
  }, [texto]);

  // Cualquier cambio de filtro vuelve a la pagina 1.
  useEffect(() => {
    setPagina(1);
  }, [textoDeb, idCategoria, estado, tamano]);

  const filtros: FiltrosAdmin = useMemo(
    () => ({
      texto: textoDeb || undefined,
      idCategoria: idCategoria === '' ? undefined : idCategoria,
      estado: estado === 'todos' ? undefined : estado,
      pagina,
      tamano,
      orden: orden.orden,
      direccion: orden.direccion,
    }),
    [textoDeb, idCategoria, estado, pagina, tamano, orden.orden, orden.direccion],
  );

  const { data, isPending, isError, refetch, isPlaceholderData } = useProductosAdmin(filtros);
  const { data: categorias } = useCategoriasAdmin();
  const conteos = data?.conteos ?? null;

  const abrirNuevo = () => {
    setIdEditar(null);
    setPanelAbierto(true);
  };
  const abrirEditar = (id: number) => {
    setIdEditar(id);
    setPanelAbierto(true);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-ancho text-apagado">Catálogo</p>
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Productos</h1>
          {conteos && (
            <p className="mt-1 text-sm text-apagado">
              {conteos.Total} productos · {conteos.Variantes} variantes · {conteos.Publicados} publicados ·{' '}
              {conteos.Agotados} agotados · {conteos.Incompletos} incompletos · {conteos.Ocultos} ocultos
            </p>
          )}
        </div>
        {esAdmin && <Boton onClick={abrirNuevo}>Nuevo producto</Boton>}
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-20 border border-borde bg-white p-4 shadow-suave">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre o SKU…"
            className="min-w-0 flex-1 rounded-pill border border-[rgba(15,23,42,.14)] bg-fondo px-4 py-2.5 text-sm outline-none focus:border-marino-600"
          />
          <select
            value={idCategoria}
            onChange={(e) => setIdCategoria(e.target.value ? Number(e.target.value) : '')}
            className="rounded-pill border border-[rgba(15,23,42,.14)] bg-white px-4 py-2.5 text-sm outline-none focus:border-marino-600"
          >
            <option value="">Todas las categorías</option>
            {categorias?.map((c) => (
              <option key={c.IDCategoria} value={c.IDCategoria}>
                {c.Nombre}
                {!c.Activo ? ' (inactiva)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CHIPS.map((ch) => {
            const n = conteos && ch.conteo ? conteos[ch.conteo] : null;
            const activo = estado === ch.clave;
            return (
              <button
                key={ch.clave}
                type="button"
                onClick={() => setEstado(ch.clave)}
                className={clsx(
                  'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                  activo ? ch.clases : 'bg-fondo-2 text-apagado hover:text-marino-700',
                )}
              >
                {ch.texto}
                {n !== null && <span className="ml-1 opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <EstadoVista
        cargando={isPending}
        error={isError}
        alReintentar={() => void refetch()}
        esqueleto={<div className="esqueleto h-80 w-full rounded-20" />}
      >
        {data && (
          <>
            {/* Escritorio (>=1024): tabla */}
            <div className={clsx('hidden overflow-x-auto rounded-20 border border-borde bg-white shadow-suave lg:block', isPlaceholderData && 'opacity-60')}>
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-borde text-left text-xs font-bold uppercase tracking-ancho text-apagado">
                    <ThOrden col="nombre" estado={orden} className="px-4 py-3">Producto</ThOrden>
                    <ThOrden col="categoria" estado={orden} className="px-4 py-3">Categoría</ThOrden>
                    <th className="px-4 py-3">Variantes</th>
                    <ThOrden col="precio" estado={orden} className="px-4 py-3">Precio desde</ThOrden>
                    <ThOrden col="disponible" estado={orden} className="px-4 py-3">Disponible</ThOrden>
                    <ThOrden col="estado" estado={orden} className="px-4 py-3">Estado</ThOrden>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((p) => (
                    <Fila key={p.IDProducto} p={p} onEditar={() => abrirEditar(p.IDProducto)} />
                  ))}
                  {data.filas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-apagado">
                        No hay productos con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Movil (<1024): tarjetas, sin scroll horizontal */}
            <div className={clsx('grid grid-cols-1 gap-3 lg:hidden', isPlaceholderData && 'opacity-60')}>
              {data.filas.map((p) => (
                <TarjetaMovil key={p.IDProducto} p={p} onEditar={() => abrirEditar(p.IDProducto)} />
              ))}
              {data.filas.length === 0 && (
                <p className="rounded-20 border border-borde bg-white p-6 text-center text-apagado">
                  No hay productos con estos filtros.
                </p>
              )}
            </div>

            {data.total > tamano && (
              <Paginacion
                pagina={pagina}
                tamanoPagina={tamano}
                total={data.total}
                onPagina={setPagina}
                onTamano={setTamano}
                tamanos={TAMANOS_PAGINA_ADMIN}
              />
            )}
          </>
        )}
      </EstadoVista>

      <PanelProducto
        idProducto={idEditar}
        abierto={panelAbierto}
        soloLectura={soloLectura}
        onCerrar={() => setPanelAbierto(false)}
      />
    </div>
  );
}

function Fila({ p, onEditar }: { p: ProductoAdminFila; onEditar: () => void }) {
  const est = ESTADO_PILL[p.EstadoDerivado];
  const oculto = p.EstadoDerivado === 'oculto';
  const skuExtra = p.SkusTotal > 3 ? ` +${p.SkusTotal - 3}` : '';

  return (
    <tr className={clsx('border-b border-borde last:border-0', oculto && 'opacity-60')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={resolverImagen(p.ImagenPrincipal)}
            alt=""
            className="h-[46px] w-[46px] shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover"
          />
          <div className="min-w-0">
            <p className="font-bold text-marino-900">{p.Nombre}</p>
            {p.SkusResumen && (
              <p className="truncate font-mono text-xs text-apagado">
                {p.SkusResumen}
                {skuExtra}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-texto">
        {p.Categoria}
        {!p.CategoriaActiva && <span className="ml-1 text-xs text-apagado">(inactiva)</span>}
      </td>
      <td className="px-4 py-3 text-texto">
        {p.CantidadVariantesActivas}/{p.CantidadVariantes}
      </td>
      <td className="px-4 py-3">
        {p.PrecioMinimo !== null ? <Precio monto={p.PrecioMinimo} className="font-semibold text-marino-900" /> : <span className="text-apagado">—</span>}
      </td>
      <td className="px-4 py-3">
        <PillDisponible p={p} />
      </td>
      <td className="px-4 py-3">
        <span className={clsx('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold', est.clases)}>
          <span className={clsx('h-1.5 w-1.5 rounded-pill', est.punto)} />
          {est.texto}
        </span>
        <p className="mt-0.5 text-[11px] text-apagado">{est.sub}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-3 text-xs font-semibold">
          <button type="button" onClick={onEditar} className="text-marino-700 hover:underline">
            Editar
          </button>
          <Link to={`/admin/inventario?producto=${p.IDProducto}`} className="text-apagado hover:text-marino-700">
            Inventario
          </Link>
        </div>
      </td>
    </tr>
  );
}

function TarjetaMovil({ p, onEditar }: { p: ProductoAdminFila; onEditar: () => void }) {
  const est = ESTADO_PILL[p.EstadoDerivado];
  const oculto = p.EstadoDerivado === 'oculto';
  const skuExtra = p.SkusTotal > 3 ? ` +${p.SkusTotal - 3}` : '';
  return (
    <article className={clsx('rounded-20 border border-borde bg-white p-4 shadow-suave', oculto && 'opacity-60')}>
      <div className="flex gap-3">
        <img
          src={resolverImagen(p.ImagenPrincipal)}
          alt=""
          className="h-14 w-14 shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-marino-900">{p.Nombre}</p>
          {p.SkusResumen && (
            <p className="truncate font-mono text-xs text-apagado">
              {p.SkusResumen}
              {skuExtra}
            </p>
          )}
          <p className="text-xs text-apagado">
            {p.Categoria}
            {!p.CategoriaActiva && ' (inactiva)'} · {p.CantidadVariantesActivas}/{p.CantidadVariantes} variantes
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PillDisponible p={p} />
        <span className={clsx('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold', est.clases)}>
          <span className={clsx('h-1.5 w-1.5 rounded-pill', est.punto)} />
          {est.texto}
        </span>
        {p.PrecioMinimo !== null && (
          <span className="ml-auto text-sm">
            <span className="text-xs text-apagado">desde </span>
            <Precio monto={p.PrecioMinimo} className="font-semibold text-marino-900" />
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEditar}
          className="rounded-pill bg-marino-600/10 px-4 py-2 text-sm font-semibold text-marino-700"
        >
          Editar
        </button>
        <Link
          to={`/admin/inventario?producto=${p.IDProducto}`}
          className="rounded-pill border border-borde px-4 py-2 text-center text-sm font-semibold text-apagado"
        >
          Inventario
        </Link>
      </div>
    </article>
  );
}

function PillDisponible({ p }: { p: ProductoAdminFila }) {
  if (p.EstadoDerivado === 'oculto') {
    return <span className="rounded-pill bg-apagado/15 px-2.5 py-1 text-xs font-semibold text-apagado">{p.DisponibleTotal}</span>;
  }
  if (p.DisponibleTotal === 0) {
    return <span className="rounded-pill bg-error/10 px-2.5 py-1 text-xs font-semibold text-error-texto">0</span>;
  }
  if (p.BajoStock) {
    return (
      <span className="rounded-pill bg-ambar/15 px-2.5 py-1 text-xs font-semibold text-naranja-700">
        {p.DisponibleTotal} · bajo
      </span>
    );
  }
  return <span className="rounded-pill bg-exito/10 px-2.5 py-1 text-xs font-semibold text-exito-texto">{p.DisponibleTotal}</span>;
}
