import { z } from 'zod';
import { correoSchema, contrasenaSchema, nombreSchema } from './common.schema.js';

export const listarUsuariosSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
  texto: z.string().trim().min(1).max(100).optional(),
  idRol: z.coerce.number().int().positive().optional(),
  activo: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  orden: z.enum(['Nombre', 'Correo', 'FechaCreacion']).default('Nombre'),
  direccion: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(['ASC', 'DESC']))
    .default('ASC'),
});

export const crearUsuarioSchema = z.object({
  correo: correoSchema,
  // F8: opcional. Si se omite, el servidor genera una contrasena temporal (12+ aleatorios)
  // y la devuelve UNA sola vez en la respuesta 201. Enviarla sigue funcionando (compat. M1).
  contrasena: contrasenaSchema.optional(),
  nombre: nombreSchema,
  idRol: z.coerce.number().int().positive(),
});

/** Query del listado de administracion con pedidos y estado de bloqueo (F8). */
export const listarUsuariosAdminSchema = z.object({
  texto: z.string().trim().min(1).max(100).optional(),
  idRol: z.coerce.number().int().positive().optional(),
  filtro: z.enum(['bloqueados', 'desactivados']).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamano: z.coerce.number().int().positive().max(100).default(20),
  // Ordenamiento del lado del servidor (lista blanca; el SP revalida -> 50422).
  orden: z.enum(['nombre', 'correo', 'rol']).optional(),
  direccion: z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).optional(),
});

export const cambiarRolSchema = z.object({
  idRol: z.coerce.number().int().positive(),
});

export const cambiarEstadoSchema = z.object({
  activo: z.boolean(),
});

/** Actualizacion del propio perfil (PUT /usuarios/me): solo nombre y telefono. */
export const perfilSchema = z.object({
  nombre: nombreSchema,
  telefono: z.string().trim().max(30).optional(),
});

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>;
export type ListarUsuariosAdminQuery = z.infer<typeof listarUsuariosAdminSchema>;
export type PerfilInput = z.infer<typeof perfilSchema>;
