import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCategoriasAdmin, useProductoAdmin } from '../../lib/consultas';
import { claves } from '../../lib/claves';
import { ErrorApi } from '../../api/clienteHttp';
import * as admin from '../../api/admin';
import { Boton } from '../../componentes/ui/Boton';
import { Campo } from '../../componentes/ui/Campo';
import { CargadorImagen } from '../../componentes/ui/CargadorImagen';
import { EstadoVista } from '../../componentes/ui/EstadoVista';
import { resolverImagen } from '../../lib/imagenes';
import { useToast } from '../../componentes/ui/Toast';
import { IconoCerrar } from '../../componentes/iconos';
import type { ProductoDetalle } from '../../api/tipos';

interface AttrForm {
  key: string;
  nombre: string;
  valor: string;
}
interface VarForm {
  key: string;
  IDVariante?: number;
  esNueva: boolean;
  sku: string;
  precio: string;
  activo: boolean;
  existencia: number;
  disponible: number;
  imagenURL: string | null;
  atributos: AttrForm[];
  // Fila de alta pendiente (caracteristica/opcion aun sin pulsar "Agregar").
  pNombre: string;
  pValor: string;
  errorSku?: string;
  errorPrecio?: string;
  errorPendiente?: string;
}
interface ImgForm {
  key: string;
  IDProductoImagen?: number;
  url: string;
  orden: number;
  esPrincipal: boolean;
}

type Pestana = 'datos' | 'variantes' | 'imagenes';

interface Props {
  idProducto: number | null; // null = nuevo
  abierto: boolean;
  soloLectura: boolean;
  onCerrar: () => void;
}

let contador = 0;
const nuevaKey = () => `k${contador++}`;

/** Precio con las mismas reglas que varianteSchema de la API: > 0, <= 99999999.99, 2 decimales. */
function precioValido(s: string): boolean {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= 99999999.99 && /^\d+(\.\d{1,2})?$/.test(s.trim());
}

export function PanelProducto({ idProducto, abierto, soloLectura, onCerrar }: Props) {
  const esNuevo = idProducto === null;
  const { data, isPending, isError, refetch } = useProductoAdmin(abierto ? idProducto : null);

  return (
    <div className={clsx('fixed inset-0 z-50 overflow-hidden', !abierto && 'pointer-events-none')} aria-hidden={!abierto}>
      <div
        className={clsx('absolute inset-0 bg-marino-900/50 transition-opacity', abierto ? 'opacity-100' : 'opacity-0')}
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={esNuevo ? 'Nuevo producto' : 'Editar producto'}
        className={clsx(
          'absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-fondo shadow-elevada transition-transform',
          abierto ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {abierto &&
          (esNuevo ? (
            <Contenido producto={null} soloLectura={soloLectura} onCerrar={onCerrar} />
          ) : (
            <EstadoVista
              cargando={isPending}
              error={isError}
              alReintentar={() => void refetch()}
              esqueleto={<div className="m-6 esqueleto h-96 rounded-20" />}
            >
              {data && <Contenido producto={data} soloLectura={soloLectura} onCerrar={onCerrar} />}
            </EstadoVista>
          ))}
      </div>
    </div>
  );
}

function Contenido({
  producto,
  soloLectura,
  onCerrar,
}: {
  producto: ProductoDetalle | null;
  soloLectura: boolean;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const { data: categorias } = useCategoriasAdmin();
  const idProducto = producto?.producto.IDProducto ?? null;

  const [pestana, setPestana] = useState<Pestana>('datos');
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const [nombre, setNombre] = useState(producto?.producto.Nombre ?? '');
  const [idCategoria, setIdCategoria] = useState<number | ''>(producto?.producto.IDCategoria ?? '');
  const [descripcion, setDescripcion] = useState(producto?.producto.Descripcion ?? '');
  const [activo, setActivo] = useState(producto?.producto.Activo ?? false);

  const [variantes, setVariantes] = useState<VarForm[]>(
    (producto?.variantes ?? []).map((v) => ({
      key: `v${v.IDVariante}`,
      IDVariante: v.IDVariante,
      esNueva: false,
      sku: v.SKU,
      precio: String(v.Precio),
      activo: v.Activo,
      existencia: v.Existencia,
      disponible: v.Disponible,
      imagenURL: v.ImagenURL,
      atributos: v.atributos.map((a, i) => ({ key: `a${v.IDVariante}-${i}`, nombre: a.Nombre, valor: a.Valor })),
      pNombre: '',
      pValor: '',
    })),
  );
  const [imagenes, setImagenes] = useState<ImgForm[]>(
    (producto?.imagenes ?? []).map((i) => ({
      key: `i${i.IDProductoImagen}`,
      IDProductoImagen: i.IDProductoImagen,
      url: i.Url,
      orden: i.Orden,
      esPrincipal: i.EsPrincipal,
    })),
  );

  const primerCampo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    primerCampo.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guardando, onCerrar]);

  const parcheVariante = (key: string, patch: Partial<VarForm>) =>
    setVariantes((arr) => arr.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // Marca un error de campo sobre una variante y lleva a la pestana Variantes.
  const errorEnVariante = (key: string, campo: 'sku' | 'precio', msg: string) => {
    parcheVariante(key, campo === 'sku' ? { errorSku: msg } : { errorPrecio: msg });
    setPestana('variantes');
  };

  const guardar = async () => {
    setErrorGeneral(null);
    setVariantes((arr) =>
      arr.map((v) => ({ ...v, errorSku: undefined, errorPrecio: undefined, errorPendiente: undefined })),
    );

    if (!nombre.trim() || idCategoria === '') {
      setErrorGeneral('Nombre y categoría son obligatorios.');
      setPestana('datos');
      return;
    }
    // Validacion local de variantes (igual que la API).
    for (const v of variantes) {
      if (!v.sku.trim()) return errorEnVariante(v.key, 'sku', 'El SKU es obligatorio');
      if (!precioValido(v.precio)) return errorEnVariante(v.key, 'precio', 'Precio inválido (> 0, hasta 2 decimales)');
      // Fila de alta pendiente: si solo tiene uno de los dos campos, bloquea.
      const pn = v.pNombre.trim();
      const pv = v.pValor.trim();
      if ((pn === '') !== (pv === '')) {
        parcheVariante(v.key, { errorPendiente: 'Completa o vacía la característica pendiente' });
        setPestana('variantes');
        return;
      }
    }

    // Incluye la fila de alta pendiente cuando tiene caracteristica y opcion.
    const atributosDe = (v: VarForm) => {
      const base = v.atributos
        .filter((a) => a.nombre.trim() && a.valor.trim())
        .map((a) => ({ nombre: a.nombre.trim(), valor: a.valor.trim() }));
      if (v.pNombre.trim() && v.pValor.trim()) {
        base.push({ nombre: v.pNombre.trim(), valor: v.pValor.trim() });
      }
      return base;
    };

    // Reporta un error de la API en el campo de la variante que lo origino.
    const manejarErrorVariante = (key: string, err: unknown): boolean => {
      if (err instanceof ErrorApi && err.status === 409) {
        errorEnVariante(key, 'sku', err.mensaje);
        return true;
      }
      if (err instanceof ErrorApi && err.status === 422) {
        errorEnVariante(key, /sku/i.test(err.mensaje) ? 'sku' : 'precio', err.mensaje);
        return true;
      }
      return false;
    };

    setGuardando(true);
    try {
      if (!producto || idProducto === null) {
        const { IDProducto } = await admin.crearProducto({
          idCategoria: Number(idCategoria),
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
        });
        for (const v of variantes) {
          try {
            await admin.crearVariante(IDProducto, {
              sku: v.sku.trim(),
              precio: Number(v.precio),
              atributos: atributosDe(v),
              imagenURL: v.imagenURL,
            });
          } catch (err) {
            if (manejarErrorVariante(v.key, err)) return;
            throw err;
          }
        }
        for (const im of imagenes) {
          await admin.agregarImagen(IDProducto, { url: im.url.trim(), orden: im.orden, esPrincipal: im.esPrincipal });
        }
        mostrar('Producto creado como Oculto; publícalo cuando tenga variantes', 'exito');
      } else {
        const p = producto.producto;
        if (
          nombre.trim() !== p.Nombre ||
          Number(idCategoria) !== p.IDCategoria ||
          (descripcion.trim() || '') !== (p.Descripcion ?? '')
        ) {
          await admin.actualizarProducto(idProducto, {
            idCategoria: Number(idCategoria),
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || undefined,
          });
        }
        for (const v of variantes) {
          try {
            if (v.IDVariante) {
              const orig = producto.variantes.find((o) => o.IDVariante === v.IDVariante);
              const cambio =
                !orig ||
                Number(orig.Precio) !== Number(v.precio) ||
                (orig.ImagenURL ?? null) !== (v.imagenURL ?? null) ||
                JSON.stringify(orig.atributos.map((a) => [a.Nombre, a.Valor])) !==
                  JSON.stringify(atributosDe(v).map((a) => [a.nombre, a.valor]));
              // El SKU de una variante existente no cambia (se envia el original).
              // Se envia imagenURL siempre (ConservarImagen=0 en la API) para fijar/quitar.
              if (cambio) {
                await admin.actualizarVariante(v.IDVariante, {
                  sku: orig?.SKU ?? v.sku.trim(),
                  precio: Number(v.precio),
                  atributos: atributosDe(v),
                  imagenURL: v.imagenURL,
                });
              }
              if (orig && orig.Activo !== v.activo) {
                await admin.cambiarEstadoVariante(v.IDVariante, v.activo);
              }
            } else {
              await admin.crearVariante(idProducto, {
                sku: v.sku.trim(),
                precio: Number(v.precio),
                atributos: atributosDe(v),
                imagenURL: v.imagenURL,
              });
            }
          } catch (err) {
            if (manejarErrorVariante(v.key, err)) return;
            throw err;
          }
        }
        for (const im of imagenes) {
          if (!im.IDProductoImagen) {
            await admin.agregarImagen(idProducto, { url: im.url.trim(), orden: im.orden, esPrincipal: im.esPrincipal });
          }
        }
        for (const o of producto.imagenes) {
          if (!imagenes.some((im) => im.IDProductoImagen === o.IDProductoImagen)) {
            await admin.eliminarImagen(idProducto, o.IDProductoImagen);
          }
        }
        const nuevaPrincipal = imagenes.find((im) => im.esPrincipal && im.IDProductoImagen);
        const antesPrincipal = producto.imagenes.find((o) => o.EsPrincipal);
        if (nuevaPrincipal && nuevaPrincipal.IDProductoImagen !== antesPrincipal?.IDProductoImagen) {
          await admin.marcarImagenPrincipal(idProducto, nuevaPrincipal.IDProductoImagen as number);
        }
        if (p.Activo !== activo) {
          await admin.cambiarEstadoProducto(idProducto, activo);
        }
        mostrar('Cambios guardados', 'exito');
      }
      await qc.invalidateQueries({ queryKey: claves.admin.todo });
      onCerrar();
    } catch (err) {
      const msg = err instanceof ErrorApi ? err.mensaje : 'No se pudo guardar';
      setErrorGeneral(msg);
      mostrar(msg, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const tabClase = (p: Pestana) =>
    clsx(
      'px-4 py-2 text-sm font-semibold border-b-2 -mb-px',
      pestana === p ? 'border-marino-700 text-marino-900' : 'border-transparent text-apagado hover:text-marino-700',
    );

  return (
    <>
      <div className="flex items-center justify-between border-b border-borde bg-white px-5 py-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">
            {idProducto === null ? 'Nuevo producto' : nombre || 'Producto'}
          </h2>
          {soloLectura && <p className="text-xs font-semibold text-naranja-700">Solo lectura</p>}
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="grid h-9 w-9 place-items-center rounded-pill text-apagado hover:bg-fondo-2"
        >
          <IconoCerrar className="h-5 w-5" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-borde bg-white px-5">
        <button type="button" className={tabClase('datos')} onClick={() => setPestana('datos')}>
          Datos
        </button>
        <button type="button" className={tabClase('variantes')} onClick={() => setPestana('variantes')}>
          Variantes ({variantes.length})
        </button>
        <button type="button" className={tabClase('imagenes')} onClick={() => setPestana('imagenes')}>
          Imágenes ({imagenes.length})
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {errorGeneral && (
          <p className="mb-4 rounded-12 bg-error/10 px-3 py-2 text-sm font-medium text-error-texto">{errorGeneral}</p>
        )}

        {pestana === 'datos' && (
          <div className="grid gap-4">
            <Campo
              ref={primerCampo}
              label="Nombre"
              value={nombre}
              disabled={soloLectura}
              onChange={(e) => setNombre(e.target.value.slice(0, 200))}
            />
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-texto">Categoría</span>
              <select
                value={idCategoria}
                disabled={soloLectura}
                onChange={(e) => setIdCategoria(e.target.value ? Number(e.target.value) : '')}
                className="rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm text-texto outline-none focus:border-marino-600 disabled:bg-fondo-2"
              >
                <option value="">Selecciona…</option>
                {categorias?.map((c) => (
                  <option key={c.IDCategoria} value={c.IDCategoria}>
                    {c.Nombre}
                    {!c.Activo ? ' (inactiva)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-texto">Descripción</span>
              <textarea
                value={descripcion ?? ''}
                disabled={soloLectura}
                onChange={(e) => setDescripcion(e.target.value.slice(0, 4000))}
                rows={5}
                className="resize-none rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3.5 py-2.5 text-sm text-texto outline-none focus:border-marino-600 disabled:bg-fondo-2"
              />
            </label>
          </div>
        )}

        {pestana === 'variantes' && (
          <div className="grid gap-3">
            <p className="rounded-12 bg-fondo-2 px-3 py-2 text-xs text-apagado">
              Las imágenes se gestionan por producto en la pestaña Imágenes.
            </p>
            {variantes.map((v) => (
              <FichaVariante
                key={v.key}
                v={v}
                soloLectura={soloLectura}
                onCambio={(patch) => parcheVariante(v.key, patch)}
                onEliminar={() => setVariantes((arr) => arr.filter((x) => x.key !== v.key))}
              />
            ))}
            {!soloLectura && (
              <button
                type="button"
                onClick={() =>
                  setVariantes((arr) => [
                    ...arr,
                    {
                      key: nuevaKey(),
                      esNueva: true,
                      sku: '',
                      precio: '',
                      activo: true,
                      existencia: 0,
                      disponible: 0,
                      imagenURL: null,
                      atributos: [],
                      pNombre: '',
                      pValor: '',
                    },
                  ])
                }
                className="rounded-16 border border-dashed border-marino-600/40 px-4 py-3 text-sm font-semibold text-marino-700 hover:bg-marino-600/5"
              >
                + Agregar variante
              </button>
            )}
          </div>
        )}

        {pestana === 'imagenes' && (
          <div className="grid gap-3">
            {imagenes.map((im, i) => (
              <div key={im.key} className="flex items-center gap-3 rounded-16 border border-borde bg-white p-3">
                <img src={resolverImagen(im.url)} alt="" className="h-14 w-14 shrink-0 rounded-12 border border-borde bg-fondo-2 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-apagado">{im.url}</p>
                  <label className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-marino-700">
                    <input
                      type="radio"
                      name="principal"
                      checked={im.esPrincipal}
                      disabled={soloLectura}
                      onChange={() => setImagenes((arr) => arr.map((x, j) => ({ ...x, esPrincipal: j === i })))}
                    />
                    Principal
                  </label>
                </div>
                {!soloLectura && (
                  <button
                    type="button"
                    onClick={() => setImagenes((arr) => arr.filter((_, j) => j !== i))}
                    className="text-xs font-semibold text-error-texto hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
            {!soloLectura && (
              <div className="flex flex-col gap-3 rounded-16 border border-dashed border-marino-600/40 p-3">
                <AgregarImagen
                  onAgregar={(url) =>
                    setImagenes((arr) => [...arr, { key: nuevaKey(), url, orden: arr.length, esPrincipal: arr.length === 0 }])
                  }
                />
                <div className="flex items-center gap-3">
                  <CargadorImagen
                    valor={null}
                    etiqueta="Subir imagen del producto"
                    onCambio={(url) =>
                      url &&
                      setImagenes((arr) => [...arr, { key: nuevaKey(), url, orden: arr.length, esPrincipal: arr.length === 0 }])
                    }
                  />
                  <p className="text-xs text-apagado">Subir imagen (JPG, PNG o WebP, hasta 2 MB) y agregarla a la lista.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-borde bg-white px-5 py-4">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-marino-900">
          <input type="checkbox" checked={activo} disabled={soloLectura} onChange={(e) => setActivo(e.target.checked)} />
          Publicado en la tienda
        </label>
        <div className="flex gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          {!soloLectura && (
            <Boton type="button" cargando={guardando} onClick={() => void guardar()}>
              Guardar cambios
            </Boton>
          )}
        </div>
      </div>
    </>
  );
}

function FichaVariante({
  v,
  soloLectura,
  onCambio,
  onEliminar,
}: {
  v: VarForm;
  soloLectura: boolean;
  onCambio: (patch: Partial<VarForm>) => void;
  onEliminar: () => void;
}) {
  const refNombre = useRef<HTMLInputElement>(null);
  const refValor = useRef<HTMLInputElement>(null);
  const puedeAgregar = v.pNombre.trim().length > 0 && v.pValor.trim().length > 0;

  // Al bloquear por caracteristica pendiente, enfoca el campo que falta.
  useEffect(() => {
    if (!v.errorPendiente) return;
    (!v.pNombre.trim() ? refNombre : refValor).current?.focus();
  }, [v.errorPendiente, v.pNombre, v.pValor]);

  const agregarCaracteristica = () => {
    if (!puedeAgregar) return;
    onCambio({
      atributos: [...v.atributos, { key: nuevaKey(), nombre: v.pNombre.trim(), valor: v.pValor.trim() }],
      pNombre: '',
      pValor: '',
      errorPendiente: undefined,
    });
  };

  return (
    <div className="rounded-16 border border-borde bg-white p-4" data-sku={v.sku}>
      {/* Cabecera: imagen propia + SKU + A la venta */}
      <div className="flex items-start gap-3">
        <CargadorImagen
          valor={v.imagenURL}
          onCambio={(url) => onCambio({ imagenURL: url })}
          soloLectura={soloLectura}
          etiqueta={`Imagen de ${v.sku || 'la variante'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <input
              value={v.sku}
              readOnly={!v.esNueva || soloLectura}
              disabled={soloLectura}
              title={!v.esNueva ? 'El SKU no cambia una vez creado' : undefined}
              onChange={(e) => v.esNueva && onCambio({ sku: e.target.value.slice(0, 50), errorSku: undefined })}
              placeholder="SKU"
              className={clsx(
                'w-40 rounded-12 border px-2.5 py-1.5 font-mono text-sm outline-none',
                v.errorSku ? 'border-error' : 'border-[rgba(15,23,42,.14)] focus:border-marino-600',
                !v.esNueva || soloLectura ? 'bg-fondo-2 text-apagado' : 'bg-white',
              )}
            />
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-marino-900">
              <input type="checkbox" checked={v.activo} disabled={soloLectura} onChange={(e) => onCambio({ activo: e.target.checked })} />
              A la venta
            </label>
            {!soloLectura && v.esNueva && (
              <button type="button" onClick={onEliminar} aria-label="Quitar variante" className="ml-auto text-apagado hover:text-error-texto">
                <IconoCerrar className="h-4 w-4" />
              </button>
            )}
          </div>
          {v.errorSku && <p className="mt-1 text-xs font-medium text-error-texto">{v.errorSku}</p>}
        </div>
      </div>

      {/* Cuerpo: precio + existencia */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs font-semibold text-texto">
          Precio
          <span
            className={clsx(
              'flex items-center rounded-12 border bg-white pl-2.5',
              v.errorPrecio ? 'border-error' : 'border-[rgba(15,23,42,.14)] focus-within:border-marino-600',
              soloLectura && 'bg-fondo-2',
            )}
          >
            <span className="text-sm text-apagado">Q</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={v.precio}
              disabled={soloLectura}
              onChange={(e) => onCambio({ precio: e.target.value, errorPrecio: undefined })}
              className="w-full bg-transparent px-2 py-1.5 text-sm outline-none"
            />
          </span>
          {v.errorPrecio && <span className="text-xs font-medium text-error-texto">{v.errorPrecio}</span>}
        </label>
        <div className="grid gap-1 text-xs font-semibold text-apagado">
          Existencia
          <span className="rounded-12 border border-borde bg-fondo-2 px-2.5 py-1.5 text-sm text-apagado">
            {v.existencia} · disponibles {v.disponible}
          </span>
          {v.IDVariante ? (
            <Link to={`/admin/inventario?variante=${v.IDVariante}`} className="text-[11px] font-semibold text-marino-700 hover:underline">
              Ajustar en Inventario
            </Link>
          ) : (
            <span className="text-[11px] font-normal text-apagado">Registra la entrada en Inventario</span>
          )}
        </div>
      </div>

      {/* Caracteristicas (tabla Caracteristica | Opcion) */}
      <div className="mt-3">
        <p className="text-xs font-semibold text-texto">Características de la variante</p>
        <p className="mb-2 text-[11px] text-apagado">
          Lo que distingue a esta variante de las demás (presentación, color, tamaño…)
        </p>
        <div className="overflow-hidden rounded-12 border border-borde">
          <div className="flex items-center gap-2 border-b border-borde bg-fondo-2 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-ancho text-apagado">
            <span className="w-1/3">Característica</span>
            <span className="min-w-0 flex-1">Opción</span>
            {!soloLectura && <span className="w-4 shrink-0" aria-hidden="true" />}
          </div>
          {v.atributos.map((a) => (
            <div key={a.key} className="flex items-center gap-2 border-b border-borde px-2.5 py-1.5 last:border-0">
              <span className="w-1/3 truncate text-sm font-semibold text-marino-900">{a.nombre}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-texto">{a.valor}</span>
              {!soloLectura && (
                <button
                  type="button"
                  aria-label={`Quitar ${a.nombre}`}
                  onClick={() => onCambio({ atributos: v.atributos.filter((x) => x.key !== a.key) })}
                  className="shrink-0 text-apagado hover:text-error-texto"
                >
                  <IconoCerrar className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {soloLectura && v.atributos.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-apagado">Sin características</p>
          )}
          {!soloLectura && (
            <div className="flex items-start gap-2 px-2.5 py-1.5">
              <input
                ref={refNombre}
                value={v.pNombre}
                onChange={(e) => onCambio({ pNombre: e.target.value.slice(0, 50), errorPendiente: undefined })}
                placeholder="Característica (p. ej. Presentación, Color)"
                className="w-1/3 rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-marino-600"
              />
              <input
                ref={refValor}
                value={v.pValor}
                onChange={(e) => onCambio({ pValor: e.target.value.slice(0, 100), errorPendiente: undefined })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    agregarCaracteristica();
                  }
                }}
                placeholder="Opción (p. ej. 1 Galón, Rojo)"
                className="min-w-0 flex-1 rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-marino-600"
              />
              <button
                type="button"
                onClick={agregarCaracteristica}
                disabled={!puedeAgregar}
                className="shrink-0 rounded-pill bg-marino-600/10 px-3 py-1.5 text-xs font-semibold text-marino-700 disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          )}
        </div>
        {v.errorPendiente && <p className="mt-1 text-xs font-medium text-error-texto">{v.errorPendiente}</p>}
      </div>
    </div>
  );
}

function AgregarImagen({ onAgregar }: { onAgregar: (url: string) => void }) {
  const [url, setUrl] = useState('');
  return (
    <div className="flex gap-2">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value.slice(0, 500))}
        placeholder="/img/productos/… o https://…"
        className="min-w-0 flex-1 rounded-12 border border-[rgba(15,23,42,.14)] bg-white px-3 py-2 text-sm outline-none focus:border-marino-600"
      />
      <button
        type="button"
        onClick={() => {
          if (!url.trim()) return;
          onAgregar(url.trim());
          setUrl('');
        }}
        className="rounded-pill bg-marino-600/10 px-4 text-sm font-semibold text-marino-700"
      >
        Agregar
      </button>
    </div>
  );
}
