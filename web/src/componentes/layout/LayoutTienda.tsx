import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import { useCarrito, useCategorias, useCuponesVigentes } from '../../lib/consultas';
import { formatearFechaCorta } from '../../lib/formato';
import { BarraInferiorMovil } from './BarraInferiorMovil';
import type { Categoria } from '../../api/tipos';
import { IconoBuscar, IconoCarrito, IconoUsuario } from '../iconos';

interface EnlaceNav {
  a: string;
  texto: string;
  destacar?: boolean;
}

/**
 * Enlace a una categoria por nombre: /catalogo?idCategoria=<id>. Devuelve null si la
 * categoria no existe (o aun no carga), para que quien lo use lo omita.
 */
function enlaceCategoria(categorias: Categoria[] | undefined, nombre: string): EnlaceNav | null {
  const cat = categorias?.find((c) => c.Nombre === nombre);
  return cat ? { a: `/catalogo?idCategoria=${cat.IDCategoria}`, texto: nombre } : null;
}

/**
 * Enlaces del menu. "Lubricantes"/"Accesorios" se resuelven a su idCategoria por
 * nombre; si la categoria no existe (o aun no carga), el enlace no se muestra.
 */
function construirEnlaces(categorias: Categoria[] | undefined): EnlaceNav[] {
  // "Mi cuenta"/"Mis pedidos"/"Ir a administración" viven en el menu del usuario, no aqui.
  return [
    { a: '/catalogo', texto: 'Catálogo' },
    { a: '/#ofertas', texto: 'Ofertas', destacar: true },
    ...['Lubricantes', 'Accesorios']
      .map((n) => enlaceCategoria(categorias, n))
      .filter((e): e is EnlaceNav => e !== null),
  ];
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="ShopCart, inicio">
      <span className="grid h-10 w-10 place-items-center rounded-12 bg-degradado-marino text-dorado shadow-marino">
        <IconoCarrito className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold tracking-apretado text-marino-900">
          ShopCart
        </span>
        <span className="block text-[11px] text-apagado">por Gasolineras Don Arturo</span>
      </span>
    </Link>
  );
}

function Buscador() {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const q = texto.trim();
    navigate(q ? `/catalogo?texto=${encodeURIComponent(q)}` : '/catalogo');
  };
  return (
    <form onSubmit={enviar} role="search" className="hidden flex-1 lg:flex">
      <div className="flex w-full items-center gap-2 rounded-pill border border-borde bg-fondo px-4 py-2">
        <IconoBuscar className="h-4 w-4 text-apagado" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca aceites, filtros, aditivos…"
          aria-label="Buscar productos"
          className="w-full bg-transparent text-sm text-texto outline-none placeholder:text-apagado"
        />
      </div>
    </form>
  );
}

function CarritoBoton({ contador }: { contador: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previo = useRef(contador);
  useEffect(() => {
    if (contador !== previo.current && ref.current) {
      ref.current.classList.remove('anim-pulse');
      // Reinicia la animacion.
      void ref.current.offsetWidth;
      ref.current.classList.add('anim-pulse');
    }
    previo.current = contador;
  }, [contador]);

  return (
    <Link
      to="/carrito"
      className="relative grid h-10 w-10 place-items-center rounded-pill text-marino-700 hover:bg-fondo-2"
      aria-label={`Carrito${contador > 0 ? `, ${contador} productos` : ''}`}
    >
      <IconoCarrito className="h-6 w-6" />
      {contador > 0 && (
        <span
          ref={ref}
          className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill bg-degradado-acento px-1 text-[11px] font-extrabold text-marino-900"
        >
          {contador}
        </span>
      )}
    </Link>
  );
}

const BOTON_REDONDO =
  'grid h-11 w-11 place-items-center rounded-pill border-[1.5px] border-[rgba(15,23,42,.14)] bg-white text-marino-700 hover:bg-fondo-2 lg:hidden';

function MenuUsuario() {
  const { usuario, cerrarSesion } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const alClicFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTecla);
    };
  }, [abierto]);

  if (!usuario) {
    // Escritorio: texto. Movil (< lg): boton redondo de 44 px con icono de usuario.
    return (
      <>
        <Link
          to="/login"
          className="hidden rounded-pill border-[1.5px] border-[rgba(15,23,42,.14)] bg-white px-4 py-2 text-sm font-semibold text-marino-700 hover:bg-fondo-2 lg:block"
        >
          Iniciar sesión
        </Link>
        <Link to="/login" aria-label="Iniciar sesión" className={BOTON_REDONDO}>
          <IconoUsuario className="h-5 w-5" />
        </Link>
      </>
    );
  }

  const esAdminOp = usuario.rol === 'Administrador' || usuario.rol === 'Operador';
  const inicial = (usuario.nombre || '?').charAt(0).toUpperCase();
  const itemMenu =
    'block w-full rounded-12 px-3 py-2 text-left text-sm font-semibold text-texto hover:bg-fondo-2';

  return (
    <>
      {/* Escritorio: chip del usuario que despliega un menu. */}
      <div ref={ref} className="relative hidden lg:block">
        <button
          type="button"
          onClick={() => setAbierto((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={abierto}
          aria-label="Menú de usuario"
          className="flex items-center gap-2 rounded-pill border-[1.5px] border-[rgba(15,23,42,.14)] bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold text-marino-700 hover:bg-fondo-2"
        >
          <span className="grid h-7 w-7 place-items-center rounded-pill bg-degradado-marino text-xs font-extrabold text-dorado">
            {inicial}
          </span>
          <span className="max-w-[14ch] truncate">{usuario.nombre}</span>
          <svg viewBox="0 0 20 20" className={clsx('h-4 w-4 transition-transform', abierto && 'rotate-180')} fill="none" aria-hidden="true">
            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {abierto && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 rounded-16 border border-borde bg-white p-1.5 shadow-elevada"
          >
            {esAdminOp ? (
              <Link role="menuitem" to="/admin" onClick={() => setAbierto(false)} className={itemMenu}>
                Ir a administración
              </Link>
            ) : (
              <>
                <Link role="menuitem" to="/cuenta" onClick={() => setAbierto(false)} className={itemMenu}>
                  Mi cuenta
                </Link>
                <Link role="menuitem" to="/mis-pedidos" onClick={() => setAbierto(false)} className={itemMenu}>
                  Mis pedidos
                </Link>
              </>
            )}
            <div className="my-1 border-t border-borde" role="separator" />
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setAbierto(false);
                void cerrarSesion();
              }}
              className="block w-full rounded-12 px-3 py-2 text-left text-sm font-semibold text-error-texto hover:bg-error/10"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
      {/* Movil: boton redondo que lleva a Mi cuenta. */}
      <Link to="/cuenta" aria-label={`Mi cuenta (${usuario.nombre})`} className={BOTON_REDONDO}>
        <IconoUsuario className="h-5 w-5" />
      </Link>
    </>
  );
}

export function LayoutTienda() {
  const { usuario } = useAuth();
  const { data } = useCuponesVigentes();
  const { data: categorias } = useCategorias();
  const { data: carrito } = useCarrito();
  const general = data?.cupones.find((c) => c.IDCategoria === null);
  const esCliente = usuario?.rol === 'Cliente';
  const enlacesNav = construirEnlaces(categorias);
  // Conteo del badge desde la MISMA consulta ['carrito']: suma de las cantidades de las
  // lineas (mismo criterio que la pagina). Sin estado ni consulta paralela.
  const contadorCarrito = (carrito?.lineas ?? []).reduce((n, l) => n + l.Cantidad, 0);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra superior */}
      <div className="bg-marino-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-2 text-center text-xs">
          <span>Envío a domicilio en 24 h</span>
          {general && (
            <span className="text-dorado">
              Usa el cupón <strong className="font-extrabold">{general.Codigo}</strong>
              {general.TipoDescuento === 'PORCENTAJE'
                ? ` y ahorra ${general.Valor}%`
                : ` y ahorra Q ${general.Valor}`}{' '}
              · vence el {formatearFechaCorta(general.FechaFin)}
            </span>
          )}
        </div>
      </div>

      {/* Encabezado */}
      <header className="sticky top-0 z-30 border-b border-borde bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Navegacion principal">
            {enlacesNav.map((e) => (
              <NavLink
                key={e.a}
                to={e.a}
                className={clsx(
                  'text-sm font-semibold hover:text-marino-700',
                  e.destacar ? 'text-naranja-600' : 'text-texto',
                )}
              >
                {e.texto}
              </NavLink>
            ))}
          </nav>
          <Buscador />
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <MenuUsuario />
            <CarritoBoton contador={contadorCarrito} />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* Pie */}
      <footer className="bg-marino-900 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-3">
          <ColumnaPie
            titulo="Tienda"
            enlaces={[
              { a: '/catalogo', t: 'Catálogo' },
              { a: '/#ofertas', t: 'Ofertas' },
              // Mismas categorias resueltas que el menu: se omiten si no existen.
              ...['Lubricantes', 'Accesorios']
                .map((n) => enlaceCategoria(categorias, n))
                .filter((e): e is EnlaceNav => e !== null)
                .map((e) => ({ a: e.a, t: e.texto })),
            ]}
          />
          <ColumnaCuenta />
          <ColumnaPie
            titulo="Ayuda"
            enlaces={[
              { a: '/catalogo', t: 'Cómo comprar' },
              { a: '/mis-pedidos', t: 'Seguimiento de pedidos' },
              { a: '/cuenta', t: 'Devoluciones' },
            ]}
          />
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-white/70">
            Precios en quetzales con IVA del 12 % incluido · ShopCart por Gasolineras Don Arturo
          </p>
        </div>
      </footer>

      <BarraInferiorMovil
        contadorCarrito={contadorCarrito}
        esCliente={esCliente}
        cuentaHref={!usuario ? '/login' : esCliente ? '/cuenta' : '/admin'}
      />
    </div>
  );
}

/** Columna "Cuenta" del pie: depende de la sesion y del rol. */
function ColumnaCuenta() {
  const { usuario, cerrarSesion } = useAuth();
  const esCliente = usuario?.rol === 'Cliente';
  const claseEnlace = 'text-sm text-white/80 hover:text-white';
  return (
    <div>
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-ancho text-dorado">Cuenta</h3>
      <ul className="flex flex-col gap-2">
        {usuario ? (
          <>
            {esCliente && (
              <>
                <li>
                  <Link to="/cuenta" className={claseEnlace}>
                    Mi cuenta
                  </Link>
                </li>
                <li>
                  <Link to="/mis-pedidos" className={claseEnlace}>
                    Mis pedidos
                  </Link>
                </li>
              </>
            )}
            <li>
              <button type="button" onClick={() => void cerrarSesion()} className={claseEnlace}>
                Cerrar sesión
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to="/login" className={claseEnlace}>
                Iniciar sesión
              </Link>
            </li>
            <li>
              <Link to="/registro" className={claseEnlace}>
                Crear cuenta
              </Link>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

function ColumnaPie({ titulo, enlaces }: { titulo: string; enlaces: { a: string; t: string }[] }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-ancho text-dorado">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {enlaces.map((e) => (
          <li key={e.t}>
            <Link to={e.a} className="text-sm text-white/80 hover:text-white">
              {e.t}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
