import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claves } from './claves';
import {
  buscarProductos,
  obtenerCategorias,
  obtenerDestacados,
  obtenerProducto,
} from '../api/catalogo';
import { agregarItem, obtenerCarrito } from '../api/carrito';
import { obtenerCuponesVigentes } from '../api/cupones';
import { obtenerMetadatos } from '../api/sistema';
import { ErrorApi } from '../api/clienteHttp';
import { useToast } from '../componentes/ui/Toast';
import type { BusquedaParams } from '../api/tipos';

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
  return useQuery({ queryKey: claves.carrito, queryFn: obtenerCarrito, staleTime: 10_000 });
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

export function useMetadatos() {
  return useQuery({ queryKey: claves.sistema.metadatos, queryFn: obtenerMetadatos, staleTime: Infinity });
}
