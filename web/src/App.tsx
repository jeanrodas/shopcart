import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { ToastProvider } from './componentes/ui/Toast';
import { LayoutTienda } from './componentes/layout/LayoutTienda';
import { PantallaCarga } from './componentes/PantallaCarga';
import { EnConstruccion } from './paginas/EnConstruccion';
import { NoEncontrado } from './paginas/NoEncontrado';
import { Prohibido } from './paginas/Prohibido';

// Lazy por pagina real.
const Inicio = lazy(() => import('./paginas/Inicio'));
const Login = lazy(() => import('./paginas/Login'));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<PantallaCarga />}>
              <Routes>
                {/* Login: pagina autonoma, sin el marco de la tienda. */}
                <Route path="/login" element={<Login />} />

                <Route element={<LayoutTienda />}>
                  <Route path="/" element={<Inicio />} />
                  <Route path="/catalogo" element={<EnConstruccion titulo="Catálogo" />} />
                  <Route path="/producto/:id" element={<EnConstruccion titulo="Detalle de producto" />} />
                  <Route path="/carrito" element={<EnConstruccion titulo="Carrito" />} />
                  <Route path="/registro" element={<EnConstruccion titulo="Crear cuenta" />} />
                  <Route
                    path="/mis-pedidos"
                    element={
                      <RutaProtegida roles={['Cliente']}>
                        <EnConstruccion titulo="Mis pedidos" />
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
