import { z } from 'zod';
import { textoPlano } from './common.schema.js';

/** Longitudes identicas a las columnas de dbo.Direccion. Texto con lista blanca. */
export const direccionSchema = z.object({
  alias: textoPlano(50),
  nombreReceptor: textoPlano(150),
  telefono: textoPlano(20),
  linea1: textoPlano(200),
  linea2: textoPlano(200, 0).optional(),
  municipio: textoPlano(100),
  departamento: textoPlano(100),
  codigoPostal: textoPlano(10, 0).optional(),
  referencia: textoPlano(300, 0).optional(),
});

export type DireccionInput = z.infer<typeof direccionSchema>;
