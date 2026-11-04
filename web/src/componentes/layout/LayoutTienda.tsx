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
  return [
    { a: '/catalogo', texto: 'Catálogo' },
    { a: '/#ofertas', texto: 'Ofertas', destacar: true },
    ...['Lubricantes', 'Accesorios']
      .map((n) => enlaceCategoria(categorias, n))
      .filter((e): e is EnlaceNav => e !== null),
    { a: '/mis-pedidos', texto: 'Mis pedidos' },
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
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm font-semibold text-marino-900 lg:block">{usuario.nombre}</span>
      <button
        type="button"
        onClick={() => void cerrarSesion()}
        className="hidden rounded-pill border-[1.5px] border-[rgba(15,23,42,.14)] bg-white px-3 py-2 text-sm font-semibold text-marino-700 hover:bg-fondo-2 lg:block"
      >
        Cerrar sesión
      </button>
      <Link to="/cuenta" aria-label={`Mi cuenta (${usuario.nombre})`} className={BOTON_REDONDO}>
        <IconoUsuario className="h-5 w-5" />
      </Link>
    </div>
  );
}

export function LayoutTienda() {
  const { data } = useCuponesVigentes();
  const { data: categorias } = useCategorias();
  const { data: carrito } = useCarrito();
  const general = data?.cupones.find((c) => c.IDCategoria === null);
  const enlacesNav = construirEnlaces(categorias);
  const contadorCarrito = carrito?.carrito?.totales.CantidadUnidades ?? 0;

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
          <ColumnaPie
            titulo="Cuenta"
            enlaces={[
              { a: '/login', t: 'Iniciar sesión' },
              { a: '/mis-pedidos', t: 'Mis pedidos' },
              { a: '/cuenta', t: 'Mi cuenta' },
            ]}
          />
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

      <BarraInferiorMovil contadorCarrito={contadorCarrito} />
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
