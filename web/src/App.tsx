import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { ToastProvider } from './componentes/ui/Toast';
import { LayoutTienda } from './componentes/layout/LayoutTienda';
import { LayoutCheckout } from './componentes/layout/LayoutCheckout';
import { PantallaCarga } from './componentes/PantallaCarga';
import { EnConstruccion } from './paginas/EnConstruccion';
import { NoEncontrado } from './paginas/NoEncontrado';
import { Prohibido } from './paginas/Prohibido';

// Lazy por pagina real.
const Inicio = lazy(() => import('./paginas/Inicio'));
const Login = lazy(() => import('./paginas/Login'));
const Catalogo = lazy(() => import('./paginas/Catalogo'));
const Producto = lazy(() => import('./paginas/Producto'));
const Carrito = lazy(() => import('./paginas/Carrito'));
const Registro = lazy(() => import('./paginas/Registro'));
const Checkout = lazy(() => import('./paginas/Checkout'));
const Confirmacion = lazy(() => import('./paginas/Confirmacion'));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PantallaCarga />}>
              <Routes>
                {/* Login y Registro: paginas autonomas, sin el marco de la tienda. */}
                <Route path="/login" element={<Login />} />
                <Route path="/registro" element={<Registro />} />

                {/* Checkout: marco propio (LayoutCheckout), solo Cliente. */}
                <Route
                  element={
                    <RutaProtegida roles={['Cliente']}>
                      <LayoutCheckout />
                    </RutaProtegida>
                  }
                >
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/checkout/confirmacion/:idPedido" element={<Confirmacion />} />
                </Route>

                <Route element={<LayoutTienda />}>
                  <Route path="/" element={<Inicio />} />
                  <Route path="/catalogo" element={<Catalogo />} />
                  <Route path="/producto/:id" element={<Producto />} />
                  <Route path="/carrito" element={<Carrito />} />
                  <Route
                    path="/mis-pedidos"
                    element={
                      <RutaProtegida roles={['Cliente']}>
                        <EnConstruccion titulo="Mis pedidos" />
                      </RutaProtegida>
                    }
                  />
                  <Route
                    path="/mis-pedidos/:id"
                    element={
                      <RutaProtegida roles={['Cliente']}>
                        <EnConstruccion titulo="Mi pedido" />
                      </RutaProtegida>
                    }
                  />
                  <Route
                    path="/cuenta"
                    element={
                      <RutaProtegida>
                        <EnConstruccion titulo="Mi cuenta" />
                      </RutaProtegida>
                    }
                  />
                  <Route path="/403" element={<Prohibido />} />
                  <Route path="*" element={<NoEncontrado />} />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
