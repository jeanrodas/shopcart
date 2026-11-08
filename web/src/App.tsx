import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { RutaProtegida } from './auth/RutaProtegida';
import { ToastProvider } from './componentes/ui/Toast';
import { LayoutTienda } from './componentes/layout/LayoutTienda';
import { LayoutCheckout } from './componentes/layout/LayoutCheckout';
import { LayoutInterno } from './componentes/layout/LayoutInterno';
import { PantallaCarga } from './componentes/PantallaCarga';
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
const MisPedidos = lazy(() => import('./paginas/MisPedidos'));
const PedidoDetalle = lazy(() => import('./paginas/PedidoDetalle'));
const Cuenta = lazy(() => import('./paginas/Cuenta'));
const AdminProductos = lazy(() => import('./paginas/admin/AdminProductos'));
const AdminCategorias = lazy(() => import('./paginas/admin/AdminCategorias'));
const AdminInventario = lazy(() => import('./paginas/admin/AdminInventario'));
const AdminPedidos = lazy(() => import('./paginas/admin/AdminPedidos'));
const PedidoOperacion = lazy(() => import('./paginas/admin/PedidoOperacion'));
const AdminCupones = lazy(() => import('./paginas/admin/AdminCupones'));
const Dashboard = lazy(() => import('./paginas/admin/Dashboard'));
const AdminBitacora = lazy(() => import('./paginas/admin/AdminBitacora'));
const AdminUsuarios = lazy(() => import('./paginas/admin/AdminUsuarios'));

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
                        <MisPedidos />
                      </RutaProtegida>
                    }
                  />
                  <Route
                    path="/mis-pedidos/:id"
                    element={
                      <RutaProtegida roles={['Cliente']}>
                        <PedidoDetalle />
                      </RutaProtegida>
                    }
                  />
                  <Route
                    path="/cuenta"
                    element={
                      <RutaProtegida roles={['Cliente', 'Operador', 'Administrador']}>
                        <Cuenta />
                      </RutaProtegida>
                    }
                  />
                  <Route path="/403" element={<Prohibido />} />
                  <Route path="*" element={<NoEncontrado />} />
                </Route>

                {/* Area interna: Administrador y Operador. Marco propio (LayoutInterno). */}
                <Route
                  path="/admin"
                  element={
                    <RutaProtegida roles={['Administrador', 'Operador']}>
                      <LayoutInterno />
                    </RutaProtegida>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="pedidos" element={<AdminPedidos />} />
                  <Route path="pedidos/:id" element={<PedidoOperacion />} />
                  <Route path="inventario" element={<AdminInventario />} />
                  <Route path="productos" element={<AdminProductos />} />
                  <Route path="categorias" element={<AdminCategorias />} />
                  {/* Cupones: solo Administrador (RF-01; la API de cupones es Administrador). */}
                  <Route
                    path="cupones"
                    element={
                      <RutaProtegida roles={['Administrador']}>
                        <AdminCupones />
                      </RutaProtegida>
                    }
                  />
                  <Route
                    path="bitacora"
                    element={
                      <RutaProtegida roles={['Administrador']}>
                        <AdminBitacora />
                      </RutaProtegida>
                    }
                  />
                  <Route
                    path="usuarios"
                    element={
                      <RutaProtegida roles={['Administrador']}>
                        <AdminUsuarios />
                      </RutaProtegida>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
