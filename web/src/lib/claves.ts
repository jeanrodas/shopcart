/** Convencion de claves de cache por modulo para TanStack Query. */
export const claves = {
  catalogo: {
    destacados: ['catalogo', 'destacados'] as const,
    categorias: ['catalogo', 'categorias'] as const,
  },
  cupones: {
    vigentes: ['cupones', 'vigentes'] as const,
  },
  sistema: {
    metadatos: ['sistema', 'metadatos'] as const,
  },
};
