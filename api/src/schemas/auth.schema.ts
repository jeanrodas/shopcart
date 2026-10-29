import { z } from 'zod';
import { correoSchema, contrasenaSchema, nombreSchema } from './common.schema.js';

export const registroSchema = z.object({
  correo: correoSchema,
  contrasena: contrasenaSchema,
  nombre: nombreSchema,
});

export const loginSchema = z.object({
  correo: correoSchema,
  contrasena: z.string().min(1, 'requerida').max(255),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().length(64, 'refresh token invalido'),
});

export const logoutSchema = refreshSchema;
