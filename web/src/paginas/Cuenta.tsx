import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { useAuth } from '../auth/useAuth';
import {
  useActualizarPerfil,
  useCrearDireccion,
  useActualizarDireccion,
  useDirecciones,
  useEliminarDireccion,
  usePerfil,
  useResumenPedidos,
} from '../lib/consultas';
import { cambiarContrasena } from '../api/cuenta';
import { ErrorApi } from '../api/clienteHttp';
import { Boton } from '../componentes/ui/Boton';
import { Campo } from '../componentes/ui/Campo';
import { Modal } from '../componentes/ui/Modal';
import { EstadoVista } from '../componentes/ui/EstadoVista';
import { useToast } from '../componentes/ui/Toast';
import { FormularioDireccion } from '../componentes/direcciones/FormularioDireccion';
import { TarjetaDireccion } from '../componentes/direcciones/TarjetaDireccion';
import type { Direccion, DireccionInput } from '../api/tipos';

const NIT_RE = /^(CF|\d{1,9}-?[\dK])$/;
const MAX_DIRECCIONES = 10;

interface Seccion {
  id: string;
  texto: string;
}
// Direcciones y Facturación son del Cliente; los usuarios internos solo ven Datos y Seguridad.
const SECCIONES_CLIENTE: Seccion[] = [
  { id: 'datos', texto: 'Datos personales' },
  { id: 'direcciones', texto: 'Direcciones' },
  { id: 'facturacion', texto: 'Facturación' },
  { id: 'seguridad', texto: 'Seguridad' },
];
const SECCIONES_INTERNO: Seccion[] = [
  { id: 'datos', texto: 'Datos personales' },
  { id: 'seguridad', texto: 'Seguridad' },
];

function mesAnio(iso: string): string {
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(d);
}

export default function Cuenta() {
  const { usuario } = useAuth();
  const esCliente = usuario?.rol === 'Cliente';
  const secciones = esCliente ? SECCIONES_CLIENTE : SECCIONES_INTERNO;
  const { data: perfil, isPending, isError, refetch } = usePerfil();
  const { data: resumen } = useResumenPedidos(esCliente);
  const { data: direcciones } = useDirecciones(esCliente);

  useEffect(() => {
    document.title = 'Mi cuenta · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, []);

  const totalPedidos = resumen?.Total ?? 0;
  const totalDirecciones = direcciones?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Cabecera */}
      <header className="relative overflow-hidden rounded-28 bg-degradado-marino p-6 text-white shadow-marino sm:p-8">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(246,162,30,.45),transparent 70%)' }}
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-pill bg-white/10 text-2xl font-extrabold text-dorado ring-2 ring-white/20">
            {(usuario?.nombre ?? '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-apretado sm:text-3xl">
              {usuario?.nombre}
            </h1>
            <p className="mt-0.5 truncate text-sm text-white/80">
              {perfil?.Correo ?? usuario?.correo}
              {esCliente && perfil?.FechaCreacion && <> · cliente desde {mesAnio(perfil.FechaCreacion)}</>}
              {!esCliente && <> · {usuario?.rol}</>}
            </p>
            {esCliente && (
              <p className="mt-1 text-sm font-semibold text-dorado">
                {totalPedidos} {totalPedidos === 1 ? 'pedido' : 'pedidos'} · {totalDirecciones}{' '}
                {totalDirecciones === 1 ? 'dirección' : 'direcciones'}
              </p>
            )}
          </div>
          {esCliente && (
            <Link
              to="/mis-pedidos"
              className="rounded-pill border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              Ver mis pedidos →
            </Link>
          )}
        </div>
      </header>

      {usuario?.debeCambiarContrasena && (
        <div className="mt-4 rounded-16 border border-ambar/40 bg-ambar/10 px-4 py-3 text-sm font-medium text-naranja-700">
          Debes cambiar tu contraseña temporal para usar el área interna. Hazlo en{' '}
          <a href="#seguridad" className="font-bold underline">Seguridad</a>.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <NavLateral secciones={secciones} />
        <div className="min-w-0">
          <EstadoVista
            cargando={isPending}
            error={isError}
            alReintentar={() => void refetch()}
            esqueleto={<div className="esqueleto h-96 w-full rounded-20" />}
          >
            {perfil && (
              <div className="flex flex-col gap-6">
                <SeccionDatos
                  nombre={perfil.Nombre}
                  correo={perfil.Correo}
                  telefono={perfil.Telefono}
                />
                {esCliente && <SeccionDirecciones />}
                {esCliente && <SeccionFacturacion />}
                <SeccionSeguridad />
              </div>
            )}
          </EstadoVista>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Navegacion -------------------------------- */

function NavLateral({ secciones }: { secciones: Seccion[] }) {
  const { cerrarSesion } = useAuth();
  const [activa, setActiva] = useState<string>('datos');

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: [0.1, 0.5] },
    );
    for (const s of secciones) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [secciones]);

  return (
    <nav className="lg:sticky lg:top-24 lg:self-start" aria-label="Secciones de mi cuenta">
      <ul className="flex gap-2 overflow-x-auto sin-barra lg:flex-col lg:gap-1">
        {secciones.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className={clsx(
                'block whitespace-nowrap rounded-12 px-3 py-2 text-sm font-semibold transition-colors',
                activa === s.id
                  ? 'bg-marino-600/10 text-marino-700'
                  : 'text-apagado hover:bg-fondo-2 hover:text-marino-700',
              )}
            >
              {s.texto}
            </a>
          </li>
        ))}
        <li className="shrink-0 lg:mt-2 lg:border-t lg:border-borde lg:pt-2">
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="block w-full whitespace-nowrap rounded-12 px-3 py-2 text-left text-sm font-semibold text-error-texto transition-colors hover:bg-error/10"
          >
            Cerrar sesión
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Tarjeta({
  id,
  titulo,
  extra,
  children,
}: {
  id: string;
  titulo: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-20 border border-borde bg-white p-6 shadow-suave"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-apretado text-marino-900">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/* --------------------------- Datos personales ----------------------------- */

const datosSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2').max(150, 'Máximo 150'),
  telefono: z.string().trim().max(30, 'Máximo 30').optional(),
});
type DatosForm = z.infer<typeof datosSchema>;

function SeccionDatos({
  nombre,
  correo,
  telefono,
}: {
  nombre: string;
  correo: string;
  telefono: string | null;
}) {
  const { actualizarUsuario } = useAuth();
  const actualizar = useActualizarPerfil();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<DatosForm>({
    resolver: zodResolver(datosSchema),
    defaultValues: { nombre, telefono: telefono ?? '' },
  });

  const enviar = handleSubmit((d) => {
    actualizar.mutate(
      { nombre: d.nombre, telefono: d.telefono?.trim() || undefined },
      {
        onSuccess: (perfil) => {
          actualizarUsuario({ nombre: perfil.Nombre });
          reset({ nombre: perfil.Nombre, telefono: perfil.Telefono ?? '' });
        },
      },
    );
  });

  return (
    <Tarjeta id="datos" titulo="Datos personales">
      <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre" error={errors.nombre?.message} {...register('nombre')} />
        <Campo label="Teléfono" placeholder="Opcional" error={errors.telefono?.message} {...register('telefono')} />
        <Campo
          label="Correo"
          value={correo}
          disabled
          ayuda="El correo es tu identificador y no se puede cambiar."
          readOnly
        />
        <div className="flex justify-end gap-3 sm:col-span-2">
          <Boton
            type="button"
            variante="fantasma"
            disabled={!isDirty || actualizar.isPending}
            onClick={() => reset({ nombre, telefono: telefono ?? '' })}
          >
            Descartar
          </Boton>
          <Boton type="submit" cargando={actualizar.isPending} disabled={!isDirty}>
            Guardar cambios
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/* ------------------------------ Direcciones ------------------------------- */

function ultimaDireccionId(): number {
  return Number(localStorage.getItem('shopcart.ultimaDireccion'));
}

function SeccionDirecciones() {
  const { data: direcciones } = useDirecciones();
  const crear = useCrearDireccion();
  const actualizar = useActualizarDireccion();
  const eliminar = useEliminarDireccion();

  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<Direccion | null>(null);
  const [aEliminar, setAEliminar] = useState<Direccion | null>(null);

  const lista = direcciones ?? [];
  const lleno = lista.length >= MAX_DIRECCIONES;

  const guardar = (datos: DireccionInput) => {
    if (editando) {
      actualizar.mutate(
        { id: editando.IDDireccion, datos },
        {
          onSuccess: () => {
            setForm(false);
            setEditando(null);
          },
        },
      );
    } else {
      crear.mutate(datos, {
        onSuccess: () => {
          setForm(false);
        },
      });
    }
  };

  return (
    <Tarjeta
      id="direcciones"
      titulo="Direcciones"
      extra={<span className="text-sm text-apagado">{lista.length} de {MAX_DIRECCIONES}</span>}
    >
      <div className="space-y-3">
        {lista.map((d) => (
          <TarjetaDireccion
            key={d.IDDireccion}
            dir={d}
            ultima={ultimaDireccionId() === d.IDDireccion}
            puedeEliminar
            onEditar={() => {
              setEditando(d);
              setForm(true);
            }}
            onEliminar={() => setAEliminar(d)}
          />
        ))}

        {form ? (
          <FormularioDireccion
            inicial={editando}
            guardando={crear.isPending || actualizar.isPending}
            onGuardar={guardar}
            onCancelar={() => {
              setForm(false);
              setEditando(null);
            }}
          />
        ) : lleno ? (
          <p className="rounded-16 border border-dashed border-borde bg-fondo px-4 py-3 text-sm text-apagado">
            Llegaste al máximo de {MAX_DIRECCIONES} direcciones. Elimina una para agregar otra.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditando(null);
              setForm(true);
            }}
            className="w-full rounded-16 border border-dashed border-marino-600/40 px-4 py-3 text-sm font-semibold text-marino-700 hover:bg-marino-600/5"
          >
            + Agregar una dirección nueva
          </button>
        )}
      </div>

      <Modal
        abierto={aEliminar !== null}
        titulo="¿Eliminar esta dirección?"
        textoConfirmar="Eliminar"
        varianteConfirmar="peligro"
        cargando={eliminar.isPending}
        alConfirmar={() => {
          if (!aEliminar) return;
          eliminar.mutate(aEliminar.IDDireccion, { onSuccess: () => setAEliminar(null) });
        }}
        alCancelar={() => setAEliminar(null)}
      >
        Se quitará <strong>{aEliminar?.Alias}</strong> de tus direcciones guardadas.
      </Modal>
    </Tarjeta>
  );
}

/* ------------------------------- Seguridad -------------------------------- */

const seguridadSchema = z
  .object({
    actual: z.string().min(1, 'Requerida'),
    // Misma regla que el registro de la API: minimo 8, al menos una letra y un numero.
    nueva: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .refine((v) => /[A-Za-z]/.test(v), 'Incluye al menos una letra')
      .refine((v) => /\d/.test(v), 'Incluye al menos un número'),
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, { path: ['confirmar'], message: 'No coincide' });
type SeguridadForm = z.infer<typeof seguridadSchema>;

function fortaleza(v: string): number {
  let n = 0;
  if (v.length >= 8) n += 1;
  if (/[a-z]/.test(v)) n += 1;
  if (/[A-Z]/.test(v)) n += 1;
  if (/\d/.test(v)) n += 1;
  return n;
}

function SeccionSeguridad() {
  const { cerrarSesion } = useAuth();
  const { mostrar } = useToast();
  const [enviando, setEnviando] = useState(false);
  const [errorActual, setErrorActual] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SeguridadForm>({ resolver: zodResolver(seguridadSchema) });

  const nueva = watch('nueva') ?? '';
  const puntos = fortaleza(nueva);

  const enviar = handleSubmit(async (d) => {
    setErrorActual(null);
    setEnviando(true);
    try {
      await cambiarContrasena(d.actual, d.nueva);
      mostrar('Contraseña actualizada; vuelve a iniciar sesión', 'exito');
      await cerrarSesion();
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 401) {
        setErrorActual('La contraseña actual no es correcta');
      } else {
        mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo cambiar la contraseña', 'error');
      }
    } finally {
      setEnviando(false);
    }
  });

  return (
    <Tarjeta id="seguridad" titulo="Seguridad">
      <form onSubmit={enviar} noValidate className="grid gap-4 sm:max-w-md">
        <Campo
          label="Contraseña actual"
          type="password"
          error={errorActual ?? errors.actual?.message}
          {...register('actual')}
        />
        <div>
          <Campo
            label="Contraseña nueva"
            type="password"
            error={errors.nueva?.message}
            {...register('nueva')}
          />
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={clsx(
                  'h-1.5 flex-1 rounded-pill transition-colors',
                  i < puntos
                    ? puntos <= 2
                      ? 'bg-error'
                      : puntos === 3
                        ? 'bg-ambar'
                        : 'bg-exito'
                    : 'bg-fondo-2',
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-apagado">Mínimo 8 caracteres, con letras y números.</p>
        </div>
        <Campo
          label="Confirmar contraseña"
          type="password"
          error={errors.confirmar?.message}
          {...register('confirmar')}
        />
        <div className="flex justify-end">
          <Boton type="submit" cargando={enviando}>
            Cambiar contraseña
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/* ------------------------------ Facturacion ------------------------------- */

interface Facturacion {
  tipo: 'CF' | 'NIT';
  nit: string;
  nombre: string;
}

function leerFacturacion(): Facturacion {
  try {
    const raw = localStorage.getItem('shopcart.facturacion');
    if (raw) {
      const d = JSON.parse(raw) as Partial<Facturacion>;
      return { tipo: d.tipo === 'NIT' ? 'NIT' : 'CF', nit: d.nit ?? '', nombre: d.nombre ?? '' };
    }
  } catch {
    /* sin localStorage */
  }
  return { tipo: 'CF', nit: '', nombre: '' };
}

function SeccionFacturacion() {
  const { mostrar } = useToast();
  const [fact, setFact] = useState<Facturacion>(() => leerFacturacion());
  const primera = useRef(true);

  const nitNorm = fact.nit.trim().toUpperCase();
  const nitValido = fact.tipo === 'CF' || (NIT_RE.test(nitNorm) && fact.nombre.trim().length >= 2);

  // No guardar en el primer render (solo cuando el usuario cambia algo).
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (!nitValido) return;
    try {
      localStorage.setItem('shopcart.facturacion', JSON.stringify(fact));
    } catch {
      /* sin localStorage */
    }
  }, [fact, nitValido]);

  return (
    <Tarjeta id="facturacion" titulo="Facturación por defecto">
      <p className="mb-4 text-sm text-apagado">
        Se usa como predeterminada en el checkout. Se guarda solo en este navegador.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['CF', 'NIT'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={fact.tipo === t}
            onClick={() => setFact((f) => ({ ...f, tipo: t }))}
            className={clsx(
              'rounded-16 border px-4 py-3 text-left text-sm font-semibold transition-colors',
              fact.tipo === t
                ? 'border-marino-700 bg-marino-600/5 text-marino-900'
                : 'border-[rgba(15,23,42,.14)] bg-white text-texto hover:border-marino-600',
            )}
          >
            {t === 'CF' ? 'Consumidor final' : 'Con NIT'}
          </button>
        ))}
      </div>
      {fact.tipo === 'NIT' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo
            label="NIT"
            value={fact.nit}
            onChange={(e) => setFact((f) => ({ ...f, nit: e.target.value.toUpperCase().slice(0, 20) }))}
            className="font-mono"
            placeholder="1234567-8"
            error={fact.nit.trim() !== '' && !NIT_RE.test(nitNorm) ? 'NIT inválido (ej. 1234567-8 o CF)' : undefined}
          />
          <Campo
            label="Nombre o razón social"
            value={fact.nombre}
            onChange={(e) => setFact((f) => ({ ...f, nombre: e.target.value.slice(0, 150) }))}
            placeholder="Nombre para la factura"
          />
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Boton
          type="button"
          variante="fantasma"
          disabled={!nitValido}
          onClick={() => mostrar('Datos de facturación guardados en este navegador', 'exito')}
        >
          Guardar
        </Boton>
      </div>
    </Tarjeta>
  );
}
