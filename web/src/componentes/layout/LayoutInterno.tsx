import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../auth/useAuth';
import { useMetadatos } from '../../lib/consultas';
import { contarPedidosOperacion, contarVariantesBajoStock } from '../../api/admin';
import {
  IconoBolsa,
  IconoCarrito,
  IconoDevolucion,
  IconoFiltro,
  IconoInicio,
  IconoReloj,
  IconoTarjeta,
  IconoUsuario,
} from '../iconos';

interface ItemNav {
  a: string;
  texto: string;
  Icono: (p: { className?: string }) => ReactNode;
  soloAdmin?: boolean;
  badge?: 'pedidos' | 'inventario';
  fin?: boolean;
}

interface Grupo {
  titulo: string;
  items: ItemNav[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'General',
    items: [
      { a: '/admin', texto: 'Dashboard', Icono: IconoInicio, fin: true },
      { a: '/admin/pedidos', texto: 'Pedidos', Icono: IconoBolsa, badge: 'pedidos' },
      { a: '/admin/inventario', texto: 'Inventario', Icono: IconoDevolucion, badge: 'inventario' },
    ],
  },
  {
    titulo: 'Catálogo',
    items: [
      { a: '/admin/productos', texto: 'Productos', Icono: IconoCarrito },
      { a: '/admin/categorias', texto: 'Categorías', Icono: IconoFiltro },
      { a: '/admin/cupones', texto: 'Cupones', Icono: IconoTarjeta, soloAdmin: true },
    ],
  },
  {
    titulo: 'Control',
    items: [
      { a: '/admin/bitacora', texto: 'Bitácora', Icono: IconoReloj, soloAdmin: true },
      { a: '/admin/usuarios', texto: 'Usuarios', Icono: IconoUsuario, soloAdmin: true },
    ],
  },
];

function Badge({ tipo }: { tipo: 'pedidos' | 'inventario' }) {
  const { data } = useQuery({
    queryKey: ['admin', 'badge', tipo],
    queryFn: tipo === 'pedidos' ? contarPedidosOperacion : contarVariantesBajoStock,
    staleTime: 30_000,
  });
  if (!data || data <= 0) return null;
  return (
    <span
      className={clsx(
        'ml-auto grid min-w-5 place-items-center rounded-pill px-1.5 text-[11px] font-extrabold',
        tipo === 'inventario' ? 'bg-error text-white' : 'bg-dorado text-marino-900',
      )}
    >
      {data}
    </span>
  );
}

function Lateral({ onNavegar }: { onNavegar?: () => void }) {
  const { usuario, cerrarSesion } = useAuth();
  const esAdmin = usuario?.rol === 'Administrador';
  return (
    <div className="flex h-full w-full flex-col bg-degradado-marino text-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-12 bg-white/10 text-dorado">
          <IconoCarrito className="h-5 w-5" />
        </span>
        <span className="text-base font-extrabold tracking-apretado">ShopCart</span>
        <span className="ml-1 rounded-pill bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navegación de administración">
        {GRUPOS.map((g) => {
          const items = g.items.filter((it) => !it.soloAdmin || esAdmin);
          if (items.length === 0) return null;
          return (
            <div key={g.titulo} className="mb-4">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-ancho text-white/40">
                {g.titulo}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map(({ a, texto, Icono, badge, fin }) => (
                  <li key={a}>
                    <NavLink
                      to={a}
                      end={fin}
                      onClick={onNavegar}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 rounded-12 px-3 py-2 text-sm font-semibold transition-colors',
                          isActive
                            ? 'bg-ambar/20 text-dorado'
                            : 'text-white/80 hover:bg-white/10 hover:text-white',
                        )
                      }
                    >
                      <Icono className="h-5 w-5" />
                      {texto}
                      {badge && <Badge tipo={badge} />}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <Link
          to="/"
          onClick={onNavegar}
          className="mb-3 flex items-center gap-2 rounded-12 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
        >
          <IconoInicio className="h-5 w-5" /> Ver la tienda
        </Link>
        <div className="rounded-16 bg-white/5 p-3">
          <p className="truncate text-sm font-bold">{usuario?.nombre}</p>
          <p className="truncate text-xs text-white/60">
            {usuario?.rol} · {usuario?.correo}
          </p>
          <button
            type="button"
            onClick={() => void cerrarSesion()}
            className="mt-2 w-full rounded-pill bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

const RUTULOS: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/pedidos': 'Pedidos',
  '/admin/inventario': 'Inventario',
  '/admin/productos': 'Productos',
  '/admin/categorias': 'Categorías',
  '/admin/cupones': 'Cupones',
  '/admin/bitacora': 'Bitácora',
  '/admin/usuarios': 'Usuarios',
};

export function LayoutInterno() {
  const { pathname } = useLocation();
  const { data: meta } = useMetadatos();
  const [drawer, setDrawer] = useState(false);
  const titulo = RUTULOS[pathname] ?? 'Administración';

  return (
    <div className="flex min-h-screen bg-fondo">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-[248px] shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-[248px]">
          <Lateral />
        </div>
      </aside>

      {/* Cajon (movil) */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-marino-900/50"
            onClick={() => setDrawer(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[248px]">
            <Lateral onNavegar={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-borde bg-white/85 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menú"
            className="grid h-9 w-9 place-items-center rounded-12 border border-borde text-marino-700 lg:hidden"
          >
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </span>
          </button>
          <nav aria-label="Migas" className="text-sm text-apagado">
            <span>Administración</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-marino-900">{titulo}</span>
          </nav>
          {meta?.modoDemo && (
            <span className="ml-auto rounded-pill bg-ambar/15 px-3 py-1 text-xs font-semibold text-naranja-700">
              Modo demo · pago simulado
            </span>
          )}
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
