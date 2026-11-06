import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claves } from './claves';
import {
  buscarProductos,
  obtenerCategorias,
  obtenerDestacados,
  obtenerProducto,
} from '../api/catalogo';
import {
  agregarItem,
  actualizarItem,
  aplicarCupon,
  obtenerCarrito,
  quitarCupon,
  quitarItem,
  vaciarCarrito,
} from '../api/carrito';
import {
  actualizarDireccion,
  crearDireccion,
  eliminarDireccion,
  listarDirecciones,
} from '../api/direcciones';
import * as checkoutApi from '../api/checkout';
import { obtenerCuponesVigentes } from '../api/cupones';
import {
  cancelarPedido,
  listarPedidos,
  obtenerPedido,
  obtenerResumenPedidos,
} from '../api/pedidos';
import { obtenerMetadatos } from '../api/sistema';
import { obtenerPerfil, actualizarPerfil } from '../api/cuenta';
import { listarProductosAdmin, obtenerProductoAdmin, listarCategoriasAdmin } from '../api/admin';
import { ErrorApi } from '../api/clienteHttp';
import { useToast } from '../componentes/ui/Toast';
import type {
  BusquedaParams,
  DireccionInput,
  FiltrosAdmin,
  FiltrosPedidos,
  PagarBody,
  PerfilInput,
} from '../api/tipos';

export function useDestacados(limite = 8) {
  return useQuery({ queryKey: claves.catalogo.destacados, queryFn: () => obtenerDestacados(limite) });
}

export function useCategorias() {
  return useQuery({ queryKey: claves.catalogo.categorias, queryFn: obtenerCategorias });
}

export function useBuscarProductos(params: BusquedaParams) {
  return useQuery({
    queryKey: claves.catalogo.productos(params),
    queryFn: () => buscarProductos(params),
    // Mantiene la pagina anterior mientras llega la nueva: la paginacion no parpadea.
    placeholderData: keepPreviousData,
  });
}

export function useProducto(id: number) {
  return useQuery({
    queryKey: claves.catalogo.producto(id),
    queryFn: () => obtenerProducto(id),
    enabled: Number.isFinite(id) && id > 0,
    retry: false,
  });
}

export function useCuponesVigentes() {
  return useQuery({ queryKey: claves.cupones.vigentes, queryFn: obtenerCuponesVigentes });
}

export function useCarrito() {
  // Pasar el signal: asi cancelQueries(['carrito']) (p. ej. al cerrar sesion) aborta de
  // verdad un refetch en vuelo y su respuesta tardia no repuebla la cache.
  return useQuery({
    queryKey: claves.carrito,
    queryFn: ({ signal }) => obtenerCarrito(signal),
    staleTime: 10_000,
  });
}

/**
 * Agrega una variante al carrito. Invalida ['carrito'] al terminar y muestra un toast:
 * "Agregado al carrito" (con accion opcional) o el mensaje EXACTO de la API en error
 * (p. ej. el 409 de existencia insuficiente).
 */
export function useAgregarAlCarrito(opciones?: {
  accionExito?: { texto: string; a: string };
  alExito?: () => void;
  alError?: () => void;
}) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: agregarItem,
    onSuccess: () => {
      mostrar('Agregado al carrito', 'exito', opciones?.accionExito);
      opciones?.alExito?.();
    },
    onError: (err) => {
      const mensaje = err instanceof ErrorApi ? err.mensaje : 'No se pudo agregar al carrito';
      mostrar(mensaje, 'error');
      opciones?.alError?.();
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.carrito });
    },
  });
}

/**
 * Base de las mutaciones del carrito: invalida ['carrito'] al terminar (la respuesta
 * de la API es la unica fuente de los totales, nunca se calculan en el navegador) y
 * muestra en un toast el mensaje EXACTO de la API ante un error. Quien llame puede
 * pasar un `onError` por mutacion (p. ej. para revertir una cantidad o mostrar el
 * error bajo el campo); ese callback se ejecuta ademas del toast.
 */
function useAccionCarrito<V>(fn: (v: V) => Promise<unknown>, fallback: string) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: fn,
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : fallback, 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.carrito });
    },
  });
}

export function useActualizarItem() {
  return useAccionCarrito(
    (v: { idVariante: number; cantidad: number }) => actualizarItem(v.idVariante, v.cantidad),
    'No se pudo actualizar la cantidad',
  );
}

export function useQuitarItem() {
  return useAccionCarrito((idVariante: number) => quitarItem(idVariante), 'No se pudo quitar el producto');
}

export function useVaciarCarrito() {
  return useAccionCarrito<void>(() => vaciarCarrito(), 'No se pudo vaciar el carrito');
}

export function useAplicarCupon() {
  return useAccionCarrito((codigo: string) => aplicarCupon(codigo), 'No se pudo aplicar el cupón');
}

export function useQuitarCupon() {
  return useAccionCarrito<void>(() => quitarCupon(), 'No se pudo quitar el cupón');
}

/* ----------------------------- Direcciones ------------------------------- */

/** Mutacion que invalida una clave y muestra el mensaje EXACTO de la API en error. */
function useMutacionInvalidando<V, R>(
  fn: (v: V) => Promise<R>,
  clave: readonly unknown[],
  fallback: string,
) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: fn,
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : fallback, 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: clave });
    },
  });
}

export function useDirecciones() {
  return useQuery({ queryKey: claves.direcciones, queryFn: listarDirecciones });
}

export function useCrearDireccion() {
  return useMutacionInvalidando(
    (datos: DireccionInput) => crearDireccion(datos),
    claves.direcciones,
    'No se pudo guardar la dirección',
  );
}

export function useActualizarDireccion() {
  return useMutacionInvalidando(
    (v: { id: number; datos: DireccionInput }) => actualizarDireccion(v.id, v.datos),
    claves.direcciones,
    'No se pudo actualizar la dirección',
  );
}

export function useEliminarDireccion() {
  return useMutacionInvalidando(
    (id: number) => eliminarDireccion(id),
    claves.direcciones,
    'No se pudo eliminar la dirección',
  );
}

/* ------------------------------- Checkout -------------------------------- */

/**
 * Inicia el checkout (reserva). Al exito deja el resumen en ['checkout','resumen']
 * para que la pagina lo lea de inmediato, y recuerda la direccion usada.
 */
export function useIniciarCheckout() {
  const qc = useQueryClient();
  // El manejo del error (409/422 -> carrito, 404 -> form, otros -> reintentar) lo decide
  // la pagina de checkout segun el status, por eso aqui no se muestra ningun toast.
  return useMutation({
    mutationFn: (idDireccion: number) => checkoutApi.iniciar(idDireccion),
    onSuccess: (data, idDireccion) => {
      qc.setQueryData(claves.checkout.resumen, data);
      try {
        localStorage.setItem('shopcart.ultimaDireccion', String(idDireccion));
      } catch {
        /* sin localStorage: no se recuerda la direccion */
      }
    },
  });
}

/** Resumen de checkout (solo lectura). Habilitado solo con sesion de Cliente. */
export function useResumenCheckout(habilitado: boolean) {
  return useQuery({
    queryKey: claves.checkout.resumen,
    queryFn: checkoutApi.resumen,
    enabled: habilitado,
    refetchOnWindowFocus: true,
  });
}

/** Paga. Sin reintento automatico: la clave de idempotencia la controla la pagina. */
export function usePagar() {
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: (v: { datos: PagarBody; clave: string }) => checkoutApi.pagar(v.datos, v.clave),
    retry: false,
    onError: (err) =>
      mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo procesar el pago', 'error'),
  });
}

export function useMetadatos() {
  return useQuery({ queryKey: claves.sistema.metadatos, queryFn: obtenerMetadatos, staleTime: Infinity });
}

/* -------------------------------- Pedidos -------------------------------- */

/** Listado de pedidos del cliente. keepPreviousData: la paginacion/filtros no parpadean. */
export function usePedidos(filtros: FiltrosPedidos) {
  return useQuery({
    queryKey: claves.pedidos.lista(filtros),
    queryFn: () => listarPedidos(filtros),
    placeholderData: keepPreviousData,
  });
}

/** Resumen de "Mis pedidos" (conteos, total comprado y envio en curso). */
export function useResumenPedidos() {
  return useQuery({ queryKey: claves.pedidos.resumen, queryFn: obtenerResumenPedidos });
}

/** Detalle de un pedido. retry:false para que el 404 (ajeno/inexistente) llegue de una vez. */
export function usePedido(id: number) {
  return useQuery({
    queryKey: claves.pedidos.uno(id),
    queryFn: () => obtenerPedido(id),
    enabled: Number.isFinite(id) && id > 0,
    retry: false,
  });
}

/**
 * Cancela un pedido. Exito: toast + invalida ['pedidos'] (lista, resumen y detalle).
 * 409/422 (otro actor cambio el estado): muestra el mensaje EXACTO de la API y refetch.
 */
export function useCancelarPedido() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; motivo: string }) => cancelarPedido(v.id, v.motivo),
    onSuccess: () => mostrar('Pedido cancelado', 'exito'),
    onError: (err) =>
      mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo cancelar el pedido', 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.pedidos.todos });
    },
  });
}

/**
 * Comprar de nuevo: agrega cada linea al carrito en secuencia. Una linea que falle
 * (409 existencia, 404/422 variante inactiva) no detiene a las demas. Al terminar,
 * invalida ['carrito'] y muestra un toast con el resumen y accion "Ver carrito".
 */
export function useComprarDeNuevo() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: async (lineas: { idVariante: number; cantidad: number }[]) => {
      let agregados = 0;
      let fallidos = 0;
      for (const l of lineas) {
        try {
          await agregarItem(l);
          agregados += 1;
        } catch {
          fallidos += 1;
        }
      }
      return { agregados, fallidos };
    },
    onSuccess: ({ agregados, fallidos }) => {
      const mensaje =
        fallidos > 0
          ? `Se agregaron ${agregados}; ${fallidos} no disponibles`
          : `${agregados} ${agregados === 1 ? 'producto agregado' : 'productos agregados'} al carrito`;
      mostrar(mensaje, fallidos > 0 ? 'info' : 'exito', { texto: 'Ver carrito', a: '/carrito' });
    },
    onError: () => mostrar('No se pudo agregar al carrito', 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.carrito });
    },
  });
}

/* -------------------------------- Mi cuenta ------------------------------- */

/** Perfil del usuario autenticado (Datos personales). */
export function usePerfil() {
  return useQuery({ queryKey: claves.cuenta.perfil, queryFn: obtenerPerfil });
}

/** Actualiza nombre y telefono; deja el perfil nuevo en cache y lo invalida. */
export function useActualizarPerfil() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: (datos: PerfilInput) => actualizarPerfil(datos),
    onSuccess: (perfil) => {
      qc.setQueryData(claves.cuenta.perfil, perfil);
      mostrar('Datos actualizados', 'exito');
    },
    onError: (err) =>
      mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudieron guardar los datos', 'error'),
  });
}

/* ----------------------- Administracion del catalogo ---------------------- */

/** Listado admin del catalogo. keepPreviousData: filtros/paginacion sin parpadeo. */
export function useProductosAdmin(filtros: FiltrosAdmin) {
  return useQuery({
    queryKey: claves.admin.productos(filtros),
    queryFn: () => listarProductosAdmin(filtros),
    placeholderData: keepPreviousData,
  });
}

/** Detalle admin de un producto (incluye inactivos) para el panel de edicion. */
export function useProductoAdmin(id: number | null) {
  return useQuery({
    queryKey: claves.admin.producto(id ?? 0),
    queryFn: () => obtenerProductoAdmin(id as number),
    enabled: id !== null && id > 0,
    retry: false,
  });
}

/** Categorias (incluye inactivas) para el selector y la administracion de categorias. */
export function useCategoriasAdmin() {
  return useQuery({ queryKey: claves.admin.categorias, queryFn: () => listarCategoriasAdmin(true) });
}
