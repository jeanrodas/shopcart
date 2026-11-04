import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { Rol } from '../api/tipos';

interface Props {
  roles?: Rol[];
  children: ReactNode;
}

/**
 * Protege una ruta: sin sesion redirige a /login guardando la ruta de origen; con
 * sesion pero rol no permitido muestra la pagina 403.
 */
export function RutaProtegida({ roles, children }: Props) {
  const { usuario } = useAuth();
  const location = useLocation();

  if (!usuario) {
    return <Navigate to="/login" state={{ desde: location.pathname }} replace />;
  }
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/403" replace />;
  }
  return <>{children}</>;
}
