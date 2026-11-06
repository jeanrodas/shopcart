import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { IconoBolsa, IconoBuscar, IconoCarrito, IconoInicio, IconoUsuario } from '../iconos';

/** Pill del contador del carrito: anima pulse una vez cuando el numero sube. */
function PillCarrito({ contador }: { contador: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previo = useRef(contador);
  useEffect(() => {
    if (contador > previo.current && ref.current) {
      ref.current.classList.remove('anim-pulse');
      void ref.current.offsetWidth; // reinicia la animacion
      ref.current.classList.add('anim-pulse');
    }
    previo.current = contador;
  }, [contador]);
  if (contador <= 0) return null;
  return (
    <span
      ref={ref}
      className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-pill bg-degradado-acento px-1 text-[10px] font-extrabold text-marino-900"
    >
      {contador}
    </span>
  );
}

interface ItemNav {
  a: string;
  texto: string;
  Icono: (p: { className?: string }) => ReactNode;
}

const ITEMS: (ItemNav & { soloCliente?: boolean })[] = [
  { a: '/', texto: 'Inicio', Icono: IconoInicio },
  { a: '/catalogo', texto: 'Catálogo', Icono: IconoBuscar },
  { a: '/carrito', texto: 'Carrito', Icono: IconoCarrito },
  { a: '/mis-pedidos', texto: 'Pedidos', Icono: IconoBolsa, soloCliente: true },
  { a: '/cuenta', texto: 'Cuenta', Icono: IconoUsuario },
];

interface Props {
  contadorCarrito?: number;
  esCliente?: boolean;
  /** Destino de la pestana "Cuenta": /cuenta con sesion de cliente, /admin para gestion, /login sin sesion. */
  cuentaHref?: string;
}

/** Barra de navegacion inferior fija (solo movil, < 900 px). */
export function BarraInferiorMovil({ contadorCarrito = 0, esCliente = false, cuentaHref = '/cuenta' }: Props) {
  const items = ITEMS.filter((it) => !it.soloCliente || esCliente).map((it) =>
    it.texto === 'Cuenta' ? { ...it, a: cuentaHref } : it,
  );
  return (
    <nav
      aria-label="Navegacion principal (movil)"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-white/85 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {items.map(({ a, texto, Icono }) => (
          <li key={a} className="flex-1">
            <NavLink
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                clsx(
                  'relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold',
                  isActive ? 'text-marino-700' : 'text-apagado',
                )
              }
            >
              <span className="relative">
                <Icono className="h-6 w-6" />
                {a === '/carrito' && <PillCarrito contador={contadorCarrito} />}
              </span>
              {texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
