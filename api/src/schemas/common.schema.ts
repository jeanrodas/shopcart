import { z } from 'zod';

/** Parametro de ruta :id (entero positivo). */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Correo normalizado: recortado, en minusculas y con formato valido. */
export const correoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'correo invalido');

/** Contrasena: minimo 8, con al menos una letra y un numero. */
export const contrasenaSchema = z
  .string()
  .min(8, 'minimo 8 caracteres')
  .max(255)
  .refine((v) => /[A-Za-z]/.test(v), 'debe incluir al menos una letra')
  .refine((v) => /\d/.test(v), 'debe incluir al menos un numero');

export const nombreSchema = z.string().trim().min(2, 'minimo 2 caracteres').max(150);
