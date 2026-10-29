import { z } from 'zod';

/** Longitudes identicas a las columnas de dbo.Direccion. */
export const direccionSchema = z.object({
  alias: z.string().trim().min(1).max(50),
  nombreReceptor: z.string().trim().min(1).max(150),
  telefono: z.string().trim().min(1).max(20),
  linea1: z.string().trim().min(1).max(200),
  linea2: z.string().trim().max(200).optional(),
  municipio: z.string().trim().min(1).max(100),
  departamento: z.string().trim().min(1).max(100),
  codigoPostal: z.string().trim().max(10).optional(),
  referencia: z.string().trim().max(300).optional(),
});

export type DireccionInput = z.infer<typeof direccionSchema>;
