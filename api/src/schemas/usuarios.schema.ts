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
  contrasena: contrasenaSchema,
  nombre: nombreSchema,
  idRol: z.coerce.number().int().positive(),
});

export const cambiarRolSchema = z.object({
  idRol: z.coerce.number().int().positive(),
});

export const cambiarEstadoSchema = z.object({
  activo: z.boolean(),
});

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosSchema>;
