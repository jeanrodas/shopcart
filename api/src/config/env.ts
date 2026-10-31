import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from './logger.js';

dotenv.config();

const booleanFromString = z
  .enum(['true', 'false'], { message: "debe ser 'true' o 'false'" })
  .transform((value) => value === 'true');

const envSchema = z
  .object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_SERVER: z.string().min(1, 'es requerida'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().min(1, 'es requerida'),
  DB_USER: z.string().min(1, 'es requerida'),
  DB_PASSWORD: z.string().min(1, 'es requerida'),
  DB_ENCRYPT: booleanFromString.default(true),
  DB_TRUST_SERVER_CERT: booleanFromString.default(false),
  DB_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  CORS_ORIGIN: z
    .string()
    .min(1, 'es requerida')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  JWT_ACCESS_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRES: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES: z.string().min(1).default('7d'),

  RESERVA_MINUTOS: z.coerce.number().int().positive().default(15),
  RESERVA_JOB_SEGUNDOS: z.coerce.number().int().positive().default(60),
  CARRITO_ABANDONO_HORAS: z.coerce.number().int().positive().default(24),
  IVA_PORCENTAJE: z.coerce.number().nonnegative().default(12),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_VENTANA_MIN: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_CHECKOUT_MAX: z.coerce.number().int().positive().default(20),

  // Pago simulado: el backend decide el resultado. Solo desarrollo/demo; en
  // produccion debe quedar en false (ver la validacion de abajo).
  PAGO_SIMULADO: booleanFromString.default(false),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV === 'production' && cfg.PAGO_SIMULADO) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAGO_SIMULADO'],
        message:
          'no puede estar activo en produccion (el pago simulado es solo para desarrollo/demo)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalles = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');
  logger.error(
    '\n[config] No se pudo iniciar: variables de entorno invalidas o faltantes.\n' +
      'Copie api/.env.example a api/.env y complete los valores.\n' +
      `Problemas detectados:\n${detalles}\n`,
  );
  process.exit(1);
}

export const env: Env = parsed.data;
