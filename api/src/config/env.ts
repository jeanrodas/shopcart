import dotenv from 'dotenv';
import { z } from 'zod';

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

  // Config tecnica de la API. La config de NEGOCIO (minutos de reserva, horas de
  // abandono, porcentaje de IVA, etc.) vive en dbo.Parametro, no en env.
  RESERVA_JOB_SEGUNDOS: z.coerce.number().int().positive().default(60),

  // Logs (pino): nivel de salida.
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),

  // Cache de reportes (RF-08): segundos de vigencia por entrada; 0 lo desactiva.
  REPORTES_CACHE_TTL_SEGUNDOS: z.coerce.number().int().nonnegative().default(60),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_VENTANA_MIN: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_CHECKOUT_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_CUPON_MAX: z.coerce.number().int().positive().default(10),
  // Tickets de eventos en vivo (F9, SSE): POST /eventos/ticket por minuto.
  RATE_LIMIT_EVENTOS_MAX: z.coerce.number().int().positive().default(10),

  // Saltos de confianza para Express (X-Forwarded-For) detras de un proxy/balanceador.
  // 0 = sin proxy (usa la IP del socket). Ver app.ts.
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(0),

  // F2: subida de imagenes del admin. Carpeta de almacenamiento (se crea al arrancar) y
  // origen publico opcional de la API (para construir URLs absolutas si se requiere).
  UPLOADS_DIR: z.string().min(1).default('uploads'),
  PUBLIC_API_URL: z.string().url().optional(),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_UPLOAD_VENTANA_MIN: z.coerce.number().int().positive().default(15),

  // Modo demo: habilita el pago simulado en un ambiente de produccion PUBLICO de
  // demostracion. En un ambiente real debe quedar en false.
  MODO_DEMO: booleanFromString.default(false),

  // Pago simulado: el backend decide el resultado. En produccion solo se permite si
  // MODO_DEMO=true (ambiente de demostracion); si no, prohibido (ver validacion abajo).
  PAGO_SIMULADO: booleanFromString.default(false),
  })
  .superRefine((cfg, ctx) => {
    // PAGO_SIMULADO=true se permite si NO es produccion, o si es produccion en MODO_DEMO.
    if (cfg.NODE_ENV === 'production' && cfg.PAGO_SIMULADO && !cfg.MODO_DEMO) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAGO_SIMULADO'],
        message:
          'no puede estar activo en produccion salvo en un ambiente de demostracion ' +
          '(ponga MODO_DEMO=true para permitirlo, o PAGO_SIMULADO=false)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalles = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');
  // Fallo de bootstrap: el logger aun no existe (depende de env), se escribe a
  // stderr directamente. No se usa console.* en el resto del codigo.
  process.stderr.write(
    '\n[config] No se pudo iniciar: variables de entorno invalidas o faltantes.\n' +
      'Copie api/.env.example a api/.env y complete los valores.\n' +
      `Problemas detectados:\n${detalles}\n`,
  );
  process.exit(1);
}

export const env: Env = parsed.data;
