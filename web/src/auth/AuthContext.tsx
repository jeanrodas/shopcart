import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cerrarSesionLocal,
  obtenerRefreshToken,
  refrescarSesion,
  registrarAlExpirarSesion,
} from '../api/clienteHttp';
import {
  iniciarSesion as apiIniciarSesion,
  registrar as apiRegistrar,
  cerrarSesion as apiCerrarSesion,
} from '../api/auth';
import type { CarritoFusionado, RespuestaSesion, Rol, Usuario } from '../api/tipos';
import { PantallaCarga } from '../componentes/PantallaCarga';

export interface AuthContextValor {
  usuario: Usuario | null;
  rol: Rol | null;
  cargando: boolean;
  iniciarSesion: (correo: string, contrasena: string) => Promise<RespuestaSesion>;
  registrar: (datos: { nombre: string; correo: string; contrasena: string }) => Promise<RespuestaSesion>;
  cerrarSesion: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValor | null>(null);

/**
 * Tras fusionar el carrito al entrar, deja una pista en sessionStorage para que la
 * pagina del carrito muestre el aviso una sola vez. Guarda solo conteos (no datos).
 */
function guardarFusion(cf?: CarritoFusionado | null): void {
  if (!cf || (cf.lineas <= 0 && cf.advertencias.length === 0)) return;
  try {
    sessionStorage.setItem(
      'shopcart.fusion',
      JSON.stringify({ lineas: cf.lineas, advertencias: cf.advertencias.length }),
    );
  } catch {
    /* almacenamiento no disponible: el aviso simplemente no se mostrara */
  }
}

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
    guardarFusion(sesion.carritoFusionado);
    return sesion;
  }, []);

  const registrar = useCallback(
    async (datos: { nombre: string; correo: string; contrasena: string }) => {
      const sesion = await apiRegistrar(datos);
      setUsuario(sesion.usuario);
      guardarFusion(sesion.carritoFusionado);
      return sesion;
    },
    [],
  );

  const cerrarSesion = useCallback(async () => {
    await apiCerrarSesion();
    setUsuario(null);
    navigate('/');
  }, [navigate]);

  const valor = useMemo<AuthContextValor>(
    () => ({ usuario, rol: usuario?.rol ?? null, cargando, iniciarSesion, registrar, cerrarSesion }),
    [usuario, cargando, iniciarSesion, registrar, cerrarSesion],
  );

  if (cargando) {
    return <PantallaCarga />;
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
