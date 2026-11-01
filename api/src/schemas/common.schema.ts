import { z } from 'zod';

// Caracteres de control (\x00-\x1F, \x7F) y los simbolos < > que podrian inyectar
// markup en lo que se muestra o exporta (xlsx, HTML del front). El rechazo de
// caracteres de control es deliberado (de ahi el disable de no-control-regex).
// eslint-disable-next-line no-control-regex
const CONTROL_O_MARKUP = /[\u0000-\u001F\u007F<>]/;
// Para texto largo (descripciones): se permiten los espacios en blanco usuales
// (\t \n \r) y solo se rechazan el resto de caracteres de control.
// eslint-disable-next-line no-control-regex
const CONTROL_PELIGROSO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Texto plano de una linea para campos que se muestran o exportan (nombres, alias,
 * motivos, campos de direccion). Recorta, acota la longitud y aplica lista blanca:
 * rechaza caracteres de control y los simbolos < >. Para campos opcionales que
 * admiten vacio, pasar min = 0.
 */
export const textoPlano = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min, `minimo ${min} caracteres`)
    .max(max, `maximo ${max} caracteres`)
    .refine((v) => !CONTROL_O_MARKUP.test(v), 'contiene caracteres no permitidos (< > o de control)');

/**
 * Texto largo (descripciones). NO restringe < > (puede haber contenido legitimo),
 * solo rechaza caracteres de control peligrosos; conserva \t, \n y \r.
 */
export const textoLargo = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `maximo ${max} caracteres`)
    .refine((v) => !CONTROL_PELIGROSO.test(v), 'contiene caracteres de control no permitidos');

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

export const nombreSchema = textoPlano(150, 2);
