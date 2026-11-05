import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  CLAVE_REFRESH,
  cerrarSesionLocal,
  obtenerRefreshToken,
  refrescarSesion,
  registrarAlExpirarSesion,
} from '../api/clienteHttp';
import {
  iniciarSesion as apiIniciarSesion,
  registrar as apiRegistrar,
  cerrarSesionServidor,
} from '../api/auth';
import { obtenerCarrito } from '../api/carrito';
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
  const queryClient = useQueryClient();

  /**
   * Al cerrar sesion (voluntaria, por expiracion u otra pestana) los datos privados del
   * usuario no deben sobrevivir en cache. Las claves sin UI persistente se quitan; la del
   * carrito se SOBRESCRIBE en el sitio con el carrito del invitado (no se remueve, porque
   * el badge del encabezado observa esa query y, si se elimina y luego se recrea, el
   * observer no refleja el valor nuevo). cancelQueries aborta (via signal) una peticion
   * autenticada en vuelo para que su respuesta tardia no repueble la cache. Las claves
   * publicas (catalogo, cupones, sistema) se conservan.
   */
  const limpiarDatosPrivados = useCallback(() => {
    for (const clave of [['direcciones'], ['checkout'], ['pedidos']]) {
      void queryClient.cancelQueries({ queryKey: clave });
      queryClient.removeQueries({ queryKey: clave });
    }
    void queryClient.cancelQueries({ queryKey: ['carrito'] });
    // Leer el carrito del invitado directo (sin token -> 0, o su carrito si tuviera
    // X-Cart-Token) y fijarlo en la misma query ['carrito'] que ve el badge.
    void (async () => {
      try {
        queryClient.setQueryData(['carrito'], await obtenerCarrito());
      } catch {
        /* sin red: un refetch posterior del propio hook lo resolvera */
      }
    })();
  }, [queryClient]);

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

  // Sesion sincronizada entre pestanas. El evento 'storage' solo se dispara en las OTRAS
  // pestanas, asi que no hay bucle con los propios cambios.
  useEffect(() => {
    const alCambiarAlmacen = (e: StorageEvent) => {
      // e.key === null en localStorage.clear(); solo nos interesa el refresh token.
      if (e.key !== CLAVE_REFRESH && e.key !== null) return;
      if (!obtenerRefreshToken()) {
        // Otra pestana cerro sesion: cerramos aqui tambien y vamos al login.
        cerrarSesionLocal();
        setUsuario(null);
        limpiarDatosPrivados();
        navigate('/login', { state: { mensaje: 'Cerraste sesión en otra pestaña' } });
        return;
      }
      // Otra pestana escribio un refresh nuevo y aqui no hay sesion: restaurarla.
      if (!usuario) {
        void (async () => {
          try {
            const sesion = await refrescarSesion();
            setUsuario(sesion.usuario);
          } catch {
            cerrarSesionLocal();
          }
        })();
      }
    };
    window.addEventListener('storage', alCambiarAlmacen);
    return () => window.removeEventListener('storage', alCambiarAlmacen);
  }, [usuario, navigate, limpiarDatosPrivados]);

  // Cuando el refresh falla a mitad de una peticion, el cliente HTTP avisa aqui.
  useEffect(() => {
    registrarAlExpirarSesion(() => {
      setUsuario(null);
      limpiarDatosPrivados();
      navigate('/login', { state: { mensaje: 'Tu sesión expiró' } });
    });
    return () => registrarAlExpirarSesion(null);
  }, [navigate, limpiarDatosPrivados]);

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
    // 1) Estado invitado y borrado de tokens, SINCRONO: el encabezado pasa a "Iniciar
    //    sesion" de inmediato y las peticiones ya no llevan Authorization.
    const rt = obtenerRefreshToken(); // capturar el refresh antes de borrarlo
    setUsuario(null);
    cerrarSesionLocal();
    // 2) Limpiar la cache de datos privados: el badge cae a 0 y ['carrito'] se refetch
    //    como invitado (sin token).
    limpiarDatosPrivados();
    navigate('/');
    // 3) Revocar el refresh en el servidor al final; su fallo no revierte el cierre local.
    try {
      await cerrarSesionServidor(rt);
    } catch {
      /* el refresh se revoca igualmente por expiracion; el cierre local ya ocurrio */
    }
  }, [navigate, limpiarDatosPrivados]);

  const valor = useMemo<AuthContextValor>(
    () => ({ usuario, rol: usuario?.rol ?? null, cargando, iniciarSesion, registrar, cerrarSesion }),
    [usuario, cargando, iniciarSesion, registrar, cerrarSesion],
  );

  if (cargando) {
    return <PantallaCarga />;
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
