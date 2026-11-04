import { useQuery } from '@tanstack/react-query';
import { claves } from './claves';
import { obtenerCategorias, obtenerDestacados } from '../api/catalogo';
import { obtenerCuponesVigentes } from '../api/cupones';
import { obtenerMetadatos } from '../api/sistema';

export function useDestacados(limite = 8) {
  return useQuery({ queryKey: claves.catalogo.destacados, queryFn: () => obtenerDestacados(limite) });
}

export function useCategorias() {
  return useQuery({ queryKey: claves.catalogo.categorias, queryFn: obtenerCategorias });
}

export function useCuponesVigentes() {
  return useQuery({ queryKey: claves.cupones.vigentes, queryFn: obtenerCuponesVigentes });
}

export function useMetadatos() {
  return useQuery({ queryKey: claves.sistema.metadatos, queryFn: obtenerMetadatos, staleTime: Infinity });
}
