import { z } from 'zod';

/** Query de GET /bitacora (Administrador): filtros opcionales + paginacion. */
export const listarBitacoraSchema = z.object({
  modulo: z.string().trim().min(1).max(50).optional(),
  entidad: z.string().trim().min(1).max(100).optional(),
  idEntidad: z.coerce.number().int().positive().optional(),
  idUsuario: z.coerce.number().int().positive().optional(),
  accion: z.enum(['CREAR', 'MODIFICAR', 'DESACTIVAR']).optional(),
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamano: z.coerce.number().int().positive().max(100).default(20),
});

export type ListarBitacoraQuery = z.infer<typeof listarBitacoraSchema>;
