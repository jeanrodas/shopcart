import { Link, Outlet } from 'react-router-dom';
import { IconoCarrito, IconoEscudo } from '../iconos';

/** Marco minimo del checkout: sin menu, buscador ni barra inferior movil. */
export function LayoutCheckout() {
  return (
    <div className="flex min-h-screen flex-col bg-fondo">
      <header className="border-b border-borde bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5" aria-label="ShopCart, inicio">
            <span className="grid h-9 w-9 place-items-center rounded-12 bg-degradado-marino text-dorado shadow-marino">
              <IconoCarrito className="h-5 w-5" />
            </span>
            <span className="text-base font-extrabold tracking-apretado text-marino-900">ShopCart</span>
          </Link>
          <span className="ml-3 hidden items-center gap-1.5 text-sm font-semibold text-exito-texto sm:inline-flex">
            <IconoEscudo className="h-4 w-4" />
            Pago seguro
          </span>
          <Link
            to="/carrito"
            className="ml-auto text-sm font-semibold text-apagado hover:text-marino-700"
          >
            Volver al carrito
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-borde bg-white">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-apagado">
          Precios en quetzales con IVA del 12 % incluido · ShopCart por Gasolineras Don Arturo
        </p>
      </footer>
    </div>
  );
}
