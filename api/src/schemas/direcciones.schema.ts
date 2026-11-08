import { z } from 'zod';
import { textoPlano } from './common.schema.js';

/** Longitudes identicas a las columnas de dbo.Direccion. Texto con lista blanca. */
export const direccionSchema = z.object({
  alias: textoPlano(50),
  nombreReceptor: textoPlano(150),
  // Telefono: solo digitos, espacios y + ( ) - (misma lista que el perfil).
  telefono: z.string().trim().min(1).max(20).regex(/^[0-9+()\-\s]+$/, 'Telefono invalido (solo digitos, espacios y + ( ) -)'),
  linea1: textoPlano(200),
  linea2: textoPlano(200, 0).optional(),
  municipio: textoPlano(100),
  departamento: textoPlano(100),
  codigoPostal: textoPlano(10, 0).optional(),
  referencia: textoPlano(300, 0).optional(),
});

export type DireccionInput = z.infer<typeof direccionSchema>;
