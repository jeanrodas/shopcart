import { z } from 'zod';

const cantidad = z.coerce.number().int().min(1).max(1000);
const idVariante = z.coerce.number().int().positive();

/** Cuerpo de POST /carrito/items: agrega (suma) cantidad de una variante. */
export const itemSchema = z.object({
  idVariante,
  cantidad,
});

/** Cuerpo de PUT /carrito/items/:idVariante: fija la cantidad de la linea. */
export const cantidadSchema = z.object({
  cantidad,
});

/** Parametro de ruta :idVariante. */
export const idVarianteParam = z.object({
  idVariante,
});

export type ItemInput = z.infer<typeof itemSchema>;
export type CantidadInput = z.infer<typeof cantidadSchema>;
