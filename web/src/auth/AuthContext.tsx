import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cerrarSesionLocal,
  obtenerRefreshToken,
  refrescarSesion,
  registrarAlExpirarSesion,
} from '../api/clienteHttp';
import { iniciarSesion as apiIniciarSesion, cerrarSesion as apiCerrarSesion } from '../api/auth';
import type { RespuestaSesion, Rol, Usuario } from '../api/tipos';
import { PantallaCarga } from '../componentes/PantallaCarga';

export interface AuthContextValor {
  usuario: Usuario | null;
  rol: Rol | null;
  cargando: boolean;
  iniciarSesion: (correo: string, contrasena: string) => Promise<RespuestaSesion>;
  cerrarSesion: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  // Al cargar la app: si hay un refresh guardado, se intenta restaurar la sesion
  // antes de mostrar las rutas (pantalla de carga breve).
  useEffect(() => {
    let activo = true;
    void (async () => {
      if (obtenerRefreshToken()) {
        try {
          const sesion = await refrescarSesion();
          if (activo) setUsuario(sesion.usuario);
        } catch {
          cerrarSesionLocal();
          if (activo) setUsuario(null);
        }
      }
      if (activo) setCargando(false);
    })();
    return () => {
      activo = false;
    };
  }, []);

  // Cuando el refresh falla a mitad de una peticion, el cliente HTTP avisa aqui.
  useEffect(() => {
    registrarAlExpirarSesion(() => {
      setUsuario(null);
      navigate('/login', { state: { mensaje: 'Tu sesión expiró' } });
    });
    return () => registrarAlExpirarSesion(null);
  }, [navigate]);

  const iniciarSesion = useCallback(async (correo: string, contrasena: string) => {
    const sesion = await apiIniciarSesion(correo, contrasena);
    setUsuario(sesion.usuario);
    return sesion;
  }, []);

  const cerrarSesion = useCallback(async () => {
    await apiCerrarSesion();
    setUsuario(null);
    navigate('/');
  }, [navigate]);

  const valor = useMemo<AuthContextValor>(
    () => ({ usuario, rol: usuario?.rol ?? null, cargando, iniciarSesion, cerrarSesion }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  );

  if (cargando) {
    return <PantallaCarga />;
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
