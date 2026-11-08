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
  // F8: busqueda de texto (LIKE sobre ValorAnterior/ValorNuevo). Aditivo.
  texto: z.string().trim().min(1).max(100).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamano: z.coerce.number().int().positive().max(100).default(20),
  // Ordenamiento del lado del servidor (lista blanca; el SP revalida -> 50422).
  orden: z.enum(['fecha']).optional(),
  direccion: z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).optional(),
});

/** Query de GET /bitacora/registro: todos los eventos de un registro (@Tabla, @IDRegistro). */
export const bitacoraPorRegistroSchema = z.object({
  tabla: z.string().trim().min(1).max(100),
  idRegistro: z.coerce.number().int().positive(),
});

export type ListarBitacoraQuery = z.infer<typeof listarBitacoraSchema>;
export type BitacoraPorRegistroQuery = z.infer<typeof bitacoraPorRegistroSchema>;
