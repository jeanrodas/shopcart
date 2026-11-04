import { useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { useMetadatos } from '../lib/consultas';
import { useToast } from '../componentes/ui/Toast';
import { ErrorApi } from '../api/clienteHttp';
import { Campo } from '../componentes/ui/Campo';
import { Boton } from '../componentes/ui/Boton';
import { IconoAlerta, IconoCarrito, IconoInfo, IconoOjo, IconoOjoCerrado } from '../componentes/iconos';

const FONDO: CSSProperties = {
  background:
    'radial-gradient(1200px 500px at 50% -10%, rgba(30,58,138,.12), transparent 70%), #f6f7fa',
};

const esquema = z.object({
  correo: z.string().min(1, 'Ingresa tu correo').email('Correo inválido'),
  contrasena: z.string().min(1, 'Ingresa tu contraseña'),
});
type Datos = z.infer<typeof esquema>;

/** Credenciales de evaluacion (ver README). Solo se ofrecen si la API esta en modo demo. */
const ACCESOS_DEMO = [
  { etiqueta: 'Entrar como Cliente', correo: 'cliente@shopcart.local', contrasena: 'Cliente123!' },
  { etiqueta: 'Entrar como Operador', correo: 'operador@shopcart.local', contrasena: 'Operador123!' },
  { etiqueta: 'Entrar como Administrador', correo: 'admin@shopcart.local', contrasena: 'Admin123!' },
] as const;

export default function Login() {
  const { iniciarSesion } = useAuth();
  const { mostrar } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const estado = (location.state ?? {}) as { desde?: string; mensaje?: string };
  const { data: metadatos } = useMetadatos();

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [verContrasena, setVerContrasena] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  const alEnviar = handleSubmit(async ({ correo, contrasena }) => {
    setErrorGeneral(null);
    try {
      const sesion = await iniciarSesion(correo, contrasena);
      if (sesion.carritoFusionado && sesion.carritoFusionado.lineas > 0) {
        mostrar('Tu carrito se unió a tu cuenta', 'exito');
      }
      navigate(estado.desde ?? '/', { replace: true });
    } catch (err) {
      setErrorGeneral(err instanceof ErrorApi ? err.mensaje : 'No se pudo iniciar sesión');
    }
  });

  const entrarComo = (correo: string, contrasena: string) => {
    setValue('correo', correo);
    setValue('contrasena', contrasena);
    void alEnviar();
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12" style={FONDO}>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-12 bg-degradado-marino text-dorado shadow-marino">
            <IconoCarrito className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold tracking-apretado text-marino-900">ShopCart</span>
        </Link>

        <div className="rounded-20 border border-borde bg-white p-6 shadow-elevada sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-apretado text-marino-900">
            Inicia sesión
          </h1>
          <p className="mt-1 text-sm text-apagado">Entra para ver tu carrito y tus pedidos.</p>

          {estado.mensaje && (
            <div className="mt-4 flex items-center gap-2 rounded-12 bg-marino-600/10 px-3 py-2 text-sm font-medium text-marino-700">
              <IconoInfo className="h-4 w-4 shrink-0" />
              {estado.mensaje}
            </div>
          )}

          <form onSubmit={alEnviar} className="mt-5 flex flex-col gap-4" noValidate>
            <Campo
              label="Correo"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              error={errors.correo?.message}
              {...register('correo')}
            />
            <Campo
              label="Contraseña"
              type={verContrasena ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Tu contraseña"
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

            {errorGeneral && (
              <p className="flex items-center gap-2 rounded-12 bg-error/10 px-3 py-2 text-sm font-medium text-error-texto">
                <IconoAlerta className="h-4 w-4 shrink-0" />
                {errorGeneral}
              </p>
            )}

            <Boton type="submit" tamano="lg" cargando={isSubmitting} className="w-full">
              Entrar
            </Boton>
          </form>

          {metadatos?.modoDemo && (
            <div className="mt-6 border-t border-borde pt-5">
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-ancho text-apagado">
                Acceso de evaluación
              </p>
              <div className="flex flex-col gap-2">
                {ACCESOS_DEMO.map((a) => (
                  <Boton
                    key={a.correo}
                    type="button"
                    variante="fantasma"
                    disabled={isSubmitting}
                    onClick={() => entrarComo(a.correo, a.contrasena)}
                    className="w-full"
                  >
                    {a.etiqueta}
                  </Boton>
                ))}
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-sm text-apagado">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-marino-700 hover:text-marino-600">
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
