import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { useAuth } from '../auth/useAuth';
import { useCarrito } from '../lib/consultas';
import { useToast } from '../componentes/ui/Toast';
import { ErrorApi, obtenerCartToken } from '../api/clienteHttp';
import { Campo } from '../componentes/ui/Campo';
import { Boton } from '../componentes/ui/Boton';
import {
  IconoAlerta,
  IconoCarrito,
  IconoCheck,
  IconoInfo,
  IconoOjo,
  IconoOjoCerrado,
} from '../componentes/iconos';

const FONDO: CSSProperties = {
  background:
    'radial-gradient(1200px 500px at 50% -10%, rgba(30,58,138,.12), transparent 70%), #f6f7fa',
};

// Simbolos < > y caracteres de control (misma lista blanca que la API para nombres).
const CONTROL_O_MARKUP = /[\u0000-\u001F\u007F<>]/;

const esquema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2, 'Mínimo 2 caracteres')
      .max(150, 'Máximo 150 caracteres')
      .refine((v) => !CONTROL_O_MARKUP.test(v), 'No uses los símbolos < o >'),
    correo: z.string().min(1, 'Ingresa tu correo').email('Correo inválido'),
    contrasena: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .refine((v) => /[A-Za-z]/.test(v), 'Incluye al menos una letra')
      .refine((v) => /\d/.test(v), 'Incluye al menos un número'),
    confirmar: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((d) => d.contrasena === d.confirmar, {
    path: ['confirmar'],
    message: 'Las contraseñas no coinciden',
  });
type Datos = z.infer<typeof esquema>;

const BENEFICIOS = [
  'Entrega a domicilio en 24 horas',
  'Cupones y ofertas exclusivas para clientes',
  'Historial de pedidos y recompra en un toque',
] as const;

/** Segmentos: longitud ≥ 8, una letra, un número, ≥ 12 caracteres. */
function criteriosFortaleza(pw: string): boolean[] {
  return [pw.length >= 8, /[A-Za-z]/.test(pw), /\d/.test(pw), pw.length >= 12];
}

function BarraFortaleza({ valor }: { valor: string }) {
  const n = criteriosFortaleza(valor).filter(Boolean).length;
  const colores = ['bg-error', 'bg-advertencia', 'bg-marino-600', 'bg-exito'];
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={clsx('h-1.5 flex-1 rounded-pill', i < n ? colores[n - 1] : 'bg-fondo-2')}
        />
      ))}
    </div>
  );
}

export default function Registro() {
  const { registrar } = useAuth();
  const { mostrar } = useToast();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const volverRaw = sp.get('volver');
  // Solo rutas internas: debe empezar con "/" pero NO con "//" ni "/\" (redireccion externa).
  const volver =
    volverRaw && volverRaw.startsWith('/') && !volverRaw.startsWith('//') && !volverRaw.startsWith('/\\')
      ? volverRaw
      : '/';

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [verContrasena, setVerContrasena] = useState(false);

  useEffect(() => {
    document.title = 'Crear cuenta · ShopCart';
    return () => {
      document.title = 'ShopCart';
    };
  }, []);

  // Aviso de carrito de invitado: solo si hay token y la API reporta unidades.
  const hayToken = Boolean(obtenerCartToken());
  const { data: carrito } = useCarrito();
  const unidadesInvitado = hayToken ? (carrito?.carrito?.totales.CantidadUnidades ?? 0) : 0;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const contrasena = watch('contrasena') ?? '';

  const alEnviar = handleSubmit(async ({ nombre, correo, contrasena: pw }) => {
    setErrorGeneral(null);
    setErrorCorreo(null);
    try {
      const sesion = await registrar({ nombre, correo, contrasena: pw });
      mostrar(`Bienvenido, ${sesion.usuario.nombre}`, 'exito');
      // AuthContext ya guardo la pista de fusion; si hubo lineas, lleva al carrito.
      if (sesion.carritoFusionado && sesion.carritoFusionado.lineas > 0) {
        navigate('/carrito', { replace: true });
      } else {
        navigate(volver, { replace: true });
      }
    } catch (err) {
      if (err instanceof ErrorApi && err.status === 409) {
        setErrorCorreo(err.mensaje);
      } else {
        setErrorGeneral(err instanceof ErrorApi ? err.mensaje : 'No se pudo crear la cuenta');
      }
    }
  });

  const tarjeta = (
    <div className="w-full max-w-md">
      <Link to="/" className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
        <span className="grid h-11 w-11 place-items-center rounded-12 bg-degradado-marino text-dorado shadow-marino">
          <IconoCarrito className="h-5 w-5" />
        </span>
        <span className="text-lg font-extrabold tracking-apretado text-marino-900">ShopCart</span>
      </Link>

      <div className="rounded-20 border border-borde bg-white p-6 shadow-elevada sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-apagado">Guarda tus datos y compra más rápido.</p>

        {unidadesInvitado > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-12 bg-marino-600/10 px-3 py-2 text-sm font-medium text-marino-700">
            <IconoInfo className="mt-0.5 h-4 w-4 shrink-0" />
            Tienes {unidadesInvitado} {unidadesInvitado === 1 ? 'unidad' : 'unidades'} en tu carrito de
            invitado; se unirán a tu cuenta.
          </div>
        )}

        <form onSubmit={alEnviar} className="mt-5 flex flex-col gap-4" noValidate>
          <Campo
            label="Nombre"
            autoComplete="name"
            placeholder="Tu nombre"
            error={errors.nombre?.message}
            {...register('nombre')}
          />
          <Campo
            label="Correo"
            type="email"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            error={errors.correo?.message ?? errorCorreo ?? undefined}
            {...register('correo')}
          />
          <div className="flex flex-col gap-1.5">
            <Campo
              label="Contraseña"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Crea una contraseña"
              ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
              error={errors.contrasena?.message}
              sufijo={
                <button
                  type="button"
                  onClick={() => setVerContrasena((v) => !v)}
                  aria-label={verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="grid h-8 w-8 place-items-center rounded-pill text-apagado hover:bg-fondo-2"
                >
                  {verContrasena ? (
                    <IconoOjoCerrado className="h-5 w-5" />
                  ) : (
                    <IconoOjo className="h-5 w-5" />
                  )}
                </button>
              }
              {...register('contrasena')}
            />
            {contrasena.length > 0 && <BarraFortaleza valor={contrasena} />}
          </div>
          <Campo
            label="Confirmar contraseña"
            type={verContrasena ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            error={errors.confirmar?.message}
            {...register('confirmar')}
          />

          {errorGeneral && (
            <p className="flex items-center gap-2 rounded-12 bg-error/10 px-3 py-2 text-sm font-medium text-error-texto">
              <IconoAlerta className="h-4 w-4 shrink-0" />
              {errorGeneral}
            </p>
          )}

          <Boton type="submit" tamano="lg" cargando={isSubmitting} className="w-full">
            Crear cuenta
          </Boton>
        </form>

        <p className="mt-5 text-center text-sm text-apagado">
          ¿Ya tienes cuenta?{' '}
          <Link
            to={`/login${volverRaw ? `?volver=${encodeURIComponent(volverRaw)}` : ''}`}
            className="font-semibold text-marino-700 hover:text-marino-600"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Columna de imagen (solo escritorio) */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/img/hero-2.jpeg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(7,20,40,.15) 0%, rgba(7,20,40,.55) 55%, rgba(7,20,40,.92) 100%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-12 bg-white/10 text-dorado">
              <IconoCarrito className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-apretado">ShopCart</span>
          </Link>
          <div>
            <h2 className="max-w-sm text-[40px] font-extrabold leading-tight tracking-apretado">
              Tu motor, atendido desde el sofá
            </h2>
            <p className="mt-3 max-w-sm text-white/80">
              Crea tu cuenta para comprar aceites, filtros y aditivos con entrega a domicilio y precios
              con IVA incluido.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {BENEFICIOS.map((b) => (
                <li key={b} className="flex items-center gap-3 text-sm font-semibold">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-dorado/20 text-dorado">
                    <IconoCheck className="h-4 w-4" />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/60">por Gasolineras Don Arturo</p>
        </div>
      </div>

      {/* Columna del formulario */}
      <div className="grid place-items-center px-4 py-12" style={FONDO}>
        {tarjeta}
      </div>
    </div>
  );
}
