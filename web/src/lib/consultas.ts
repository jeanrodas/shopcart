import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
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
import { listarCuponesAdmin, obtenerResumenCupones } from '../api/cupones';
import { listarBitacora, listarModulosBitacora } from '../api/bitacora';
import { listarUsuariosAdmin } from '../api/usuarios';
import {
  obtenerResumenDashboard,
  obtenerVentasPorDia,
  obtenerVentasPorCategoria,
  obtenerEmbudo,
  obtenerHorasPico,
  obtenerTopProductosDashboard,
  obtenerCuponesDashboard,
} from '../api/dashboard';
import {
  listarInventarioAdmin,
  obtenerResumenInventario,
  listarKardex,
  verificarConsistencia,
  registrarEntrada,
  registrarAjuste,
} from '../api/inventario';
import {
  listarPedidosOperacion,
  obtenerResumenOperacion,
  cambiarEstadoPedido,
  cancelarPedidoOperacion,
  registrarDevolucion,
} from '../api/operacion';
import { ErrorApi } from '../api/clienteHttp';
import { useToast } from '../componentes/ui/Toast';
import type {
  AjusteBody,
  BusquedaParams,
  DireccionInput,
  EntradaBody,
  FiltrosAdmin,
  FiltrosBitacora,
  FiltrosCupones,
  FiltrosInventario,
  FiltrosPedidos,
  FiltrosPedidosOperacion,
  FiltrosUsuarios,
  Granularidad,
  PagarBody,
  PerfilInput,
  RangoDashboard,
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
  // El carrito es de invitado o Cliente: Operador/Administrador no lo consultan (evita un
  // fetch innecesario para roles internos que navegan la tienda).
  const { usuario } = useAuth();
  const habilitado = !usuario || usuario.rol === 'Cliente';
  // Pasar el signal: asi cancelQueries(['carrito']) (p. ej. al cerrar sesion) aborta de
  // verdad un refetch en vuelo y su respuesta tardia no repuebla la cache.
  return useQuery({
    queryKey: claves.carrito,
    queryFn: ({ signal }) => obtenerCarrito(signal),
    enabled: habilitado,
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

export function useDirecciones(habilitado = true) {
  return useQuery({ queryKey: claves.direcciones, queryFn: listarDirecciones, enabled: habilitado });
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
export function useResumenPedidos(habilitado = true) {
  return useQuery({ queryKey: claves.pedidos.resumen, queryFn: obtenerResumenPedidos, enabled: habilitado });
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

/* --------------------------- Operacion: inventario ------------------------ */

/** Tablero de inventario. keepPreviousData: filtros/paginacion sin parpadeo. */
export function useInventarioAdmin(filtros: FiltrosInventario) {
  return useQuery({
    queryKey: claves.inventario.lista(filtros),
    queryFn: () => listarInventarioAdmin(filtros),
    placeholderData: keepPreviousData,
  });
}

/** KPIs del tablero de inventario. */
export function useResumenInventario() {
  return useQuery({
    queryKey: claves.inventario.resumen,
    queryFn: obtenerResumenInventario,
    staleTime: 15_000,
  });
}

/** Kardex de una variante (habilitado solo con una variante valida). */
export function useKardex(idVariante: number | null, pagina = 1, tamanoPagina = 20) {
  return useQuery({
    queryKey: [...claves.inventario.kardex(idVariante ?? 0), pagina, tamanoPagina] as const,
    queryFn: () => listarKardex(idVariante as number, pagina, tamanoPagina),
    enabled: idVariante !== null && idVariante > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * Verifica la consistencia del invariante (solo Administrador). Mutacion: la dispara el
 * boton y el resultado se muestra en un modal. El 403 de Operador lo maneja el llamador.
 */
export function useVerificarConsistencia() {
  return useMutation({ mutationFn: verificarConsistencia });
}

/**
 * Registra un movimiento (entrada o ajuste). Exito: toast + invalida inventario (tabla,
 * resumen, kardex). Error: muestra el mensaje EXACTO de la API (p. ej. 422 de disponible).
 */
export function useRegistrarMovimiento() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: (v: EntradaBody | AjusteBody) =>
      'tipo' in v ? registrarAjuste(v) : registrarEntrada(v),
    onSuccess: (_d, v) =>
      mostrar('tipo' in v ? 'Ajuste registrado' : 'Entrada registrada', 'exito'),
    onError: (err) =>
      mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo registrar el movimiento', 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.inventario.todo });
      // El badge del menu lee el resumen de inventario.
      void qc.invalidateQueries({ queryKey: ['admin', 'badge', 'inventario'] });
    },
  });
}

/* ---------------------------- Operacion: pedidos -------------------------- */

/** Listado de pedidos de operacion. keepPreviousData para filtros/paginacion. */
export function usePedidosOperacion(filtros: FiltrosPedidosOperacion) {
  return useQuery({
    queryKey: claves.operacion.lista(filtros),
    queryFn: () => listarPedidosOperacion(filtros),
    placeholderData: keepPreviousData,
  });
}

/** Resumen de operacion de pedidos (cabecera y tarjetas de flujo). */
export function useResumenOperacion() {
  return useQuery({
    queryKey: claves.operacion.resumen,
    queryFn: obtenerResumenOperacion,
    staleTime: 15_000,
  });
}

/** Detalle de un pedido para operacion (reusa GET /pedidos/:id; sin filtro de cliente). */
export function usePedidoOperacion(id: number) {
  return useQuery({
    queryKey: claves.operacion.uno(id),
    queryFn: () => obtenerPedido(id),
    enabled: Number.isFinite(id) && id > 0,
    retry: false,
  });
}

/**
 * Base de las transiciones de operacion: exito -> toast + invalida operacion (lista,
 * resumen, detalle) y los badges; 409/422 (otro operador movio el pedido) -> muestra el
 * mensaje EXACTO de la API y refresca de todos modos.
 */
function useAccionOperacion<V>(fn: (v: V) => Promise<unknown>, exito: string, fallback: string) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => mostrar(exito, 'exito'),
    onError: (err) => mostrar(err instanceof ErrorApi ? err.mensaje : fallback, 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.operacion.todo });
      void qc.invalidateQueries({ queryKey: ['admin', 'badge', 'pedidos'] });
    },
  });
}

export function useCambiarEstadoPedido() {
  return useAccionOperacion(
    (v: { id: number; estado: 'EN_PREPARACION' | 'DESPACHADO' | 'ENTREGADO'; comentario?: string }) =>
      cambiarEstadoPedido(v.id, v.estado, v.comentario),
    'Estado actualizado',
    'No se pudo cambiar el estado',
  );
}

export function useCancelarPedidoOperacion() {
  return useAccionOperacion(
    (v: { id: number; motivo: string }) => cancelarPedidoOperacion(v.id, v.motivo),
    'Pedido cancelado',
    'No se pudo cancelar el pedido',
  );
}

export function useRegistrarDevolucion() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationFn: (v: { id: number; motivo: string; lineas: { idPedidoDetalle: number; cantidad: number }[] }) =>
      registrarDevolucion(v.id, v.motivo, v.lineas),
    onSuccess: (_d, v) => {
      const n = v.lineas.reduce((s, l) => s + l.cantidad, 0);
      mostrar(`Devolución registrada · reintegradas ${n} ${n === 1 ? 'unidad' : 'unidades'}`, 'exito');
    },
    onError: (err) =>
      mostrar(err instanceof ErrorApi ? err.mensaje : 'No se pudo registrar la devolución', 'error'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: claves.operacion.todo });
      void qc.invalidateQueries({ queryKey: ['admin', 'badge', 'pedidos'] });
    },
  });
}

/* ------------------------------ Control (F8) ------------------------------ */

/** Listado de administracion de cupones. keepPreviousData: filtros/paginacion sin parpadeo. */
export function useCuponesAdmin(filtros: FiltrosCupones) {
  return useQuery({
    queryKey: claves.cupones.lista(filtros),
    queryFn: () => listarCuponesAdmin(filtros),
    placeholderData: keepPreviousData,
  });
}

/** KPIs del panel de cupones. */
export function useResumenCupones() {
  return useQuery({ queryKey: claves.cupones.resumen, queryFn: obtenerResumenCupones, staleTime: 15_000 });
}

/** Bitacora de auditoria. keepPreviousData para filtros/paginacion. */
export function useBitacora(filtros: FiltrosBitacora) {
  return useQuery({
    queryKey: claves.bitacora.lista(filtros),
    queryFn: () => listarBitacora(filtros),
    placeholderData: keepPreviousData,
  });
}

/** Modulos presentes en la bitacora (para el filtro). */
export function useModulosBitacora() {
  return useQuery({ queryKey: claves.bitacora.modulos, queryFn: listarModulosBitacora, staleTime: Infinity });
}

/** Listado de administracion de usuarios. keepPreviousData para filtros/paginacion. */
export function useUsuariosAdmin(filtros: FiltrosUsuarios) {
  return useQuery({
    queryKey: claves.usuarios.lista(filtros),
    queryFn: () => listarUsuariosAdmin(filtros),
    placeholderData: keepPreviousData,
  });
}

/* ------------------------------ Dashboard (F9) ---------------------------- */

// El periodo gobierna todos los bloques; keepPreviousData evita el parpadeo al cambiarlo.
// Cada bloque es una consulta independiente para que un error no tumbe el resto.

// Los bloques de negocio del dashboard son SOLO del Administrador (RF-01). `habilitado`
// (= esAdmin) evita que el Operador dispare la consulta y reciba un 403.
export function useDashboardResumen(r: RangoDashboard, habilitado = true) {
  return useQuery({
    queryKey: claves.dashboard.resumen(r),
    queryFn: () => obtenerResumenDashboard(r),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useVentasPorDia(r: RangoDashboard, granularidad: Granularidad = 'DIA', habilitado = true) {
  return useQuery({
    queryKey: [...claves.dashboard.ventasDia(r), granularidad] as const,
    queryFn: () => obtenerVentasPorDia(r, granularidad),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useCategoriasDashboard(r: RangoDashboard, habilitado = true) {
  return useQuery({
    queryKey: claves.dashboard.categorias(r),
    queryFn: () => obtenerVentasPorCategoria(r),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useEmbudo(r: RangoDashboard, habilitado = true) {
  return useQuery({
    queryKey: claves.dashboard.embudo(r),
    queryFn: () => obtenerEmbudo(r),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useHorasPico(r: RangoDashboard, habilitado = true) {
  return useQuery({
    queryKey: claves.dashboard.horas(r),
    queryFn: () => obtenerHorasPico(r),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}

export function useTopProductosDashboard(r: RangoDashboard, top = 8) {
  return useQuery({
    queryKey: [...claves.dashboard.top(r), top] as const,
    queryFn: () => obtenerTopProductosDashboard(r, top),
    placeholderData: keepPreviousData,
  });
}

export function useCuponesDashboard(r: RangoDashboard, top = 8, habilitado = true) {
  return useQuery({
    queryKey: [...claves.dashboard.cupones(r), top] as const,
    queryFn: () => obtenerCuponesDashboard(r, top),
    enabled: habilitado,
    placeholderData: keepPreviousData,
  });
}
