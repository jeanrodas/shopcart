import { z } from 'zod';
import { textoPlano } from './common.schema.js';

/** Cuerpo de POST /pedidos/:id/estado (Operador/Admin): avance de estado. */
export const cambiarEstadoSchema = z.object({
  estado: z.enum(['EN_PREPARACION', 'DESPACHADO', 'ENTREGADO']),
  comentario: textoPlano(300, 3).optional(),
});

/** Cuerpo de POST /pedidos/:id/cancelar: motivo de la cancelacion. */
export const cancelarSchema = z.object({
  motivo: textoPlano(300, 3),
});

/** Cuerpo de POST /pedidos/:id/devoluciones: motivo y lineas a devolver. */
export const devolucionSchema = z.object({
  motivo: textoPlano(300, 3),
  lineas: z
    .array(
      z.object({
        idPedidoDetalle: z.coerce.number().int().positive(),
        cantidad: z.coerce.number().int().min(1).max(1000),
      }),
    )
    .min(1, 'al menos una linea')
    .max(50, 'maximo 50 lineas'),
});

/** Codigos de estado validos para el filtro de listado. */
export const CODIGOS_ESTADO_PEDIDO = [
  'PAGADO',
  'EN_PREPARACION',
  'DESPACHADO',
  'ENTREGADO',
  'CANCELADO',
  'DEVUELTO',
] as const;

/** Query de GET /pedidos (filtros opcionales + paginacion). */
export const listarPedidosQuerySchema = z.object({
  // estado acepta un codigo o varios separados por coma (p. ej. 'PAGADO,EN_PREPARACION');
  // el cliente lo usa para el filtro "En curso". Un solo codigo sigue siendo valido.
  estado: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(
      (v) =>
        v
          .split(',')
          .every((c) => (CODIGOS_ESTADO_PEDIDO as readonly string[]).includes(c.trim())),
      'estado invalido',
    )
    .optional(),
  idUsuario: z.coerce.number().int().positive().optional(),
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
  // recienteDias (Operador/Admin): ventana por ultima actualizacion para estados terminales
  // (ENTREGADO, CANCELADO, DEVUELTO), para que el listado coincida con las tarjetas del resumen.
  recienteDias: z.coerce.number().int().min(1).max(365).optional(),
  // texto: Operador/Admin (NumeroPedido o correo). numero: busqueda del cliente por NumeroPedido.
  texto: z.string().trim().min(1).max(100).optional(),
  numero: z.string().trim().min(1).max(30).optional(),
  orden: z.enum(['ASC', 'DESC']).optional(),
  // Operacion (Operador/Admin): columna + direccion del ordenamiento del lado del servidor.
  // `orden` (arriba) es la direccion simple del listado del Cliente; aqui se usa un nombre
  // distinto para no chocar. Lista blanca; el SP revalida -> 50422.
  ordenCol: z.enum(['numero', 'fecha', 'total', 'estado', 'hace']).optional(),
  direccion: z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
  // alias del cliente para tamanoPagina; si no viene, se usa tamanoPagina.
  tamano: z.coerce.number().int().positive().max(100).optional(),
});

export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;
export type CancelarInput = z.infer<typeof cancelarSchema>;
export type DevolucionInput = z.infer<typeof devolucionSchema>;
export type ListarPedidosQuery = z.infer<typeof listarPedidosQuerySchema>;
