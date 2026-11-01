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

/** Query de GET /pedidos (filtros opcionales + paginacion). */
export const listarPedidosQuerySchema = z.object({
  estado: z
    .enum(['PAGADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO', 'DEVUELTO'])
    .optional(),
  idUsuario: z.coerce.number().int().positive().optional(),
  desde: z.string().datetime({ offset: true }).optional(),
  hasta: z.string().datetime({ offset: true }).optional(),
  texto: z.string().trim().min(1).max(100).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
});

export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;
export type CancelarInput = z.infer<typeof cancelarSchema>;
export type DevolucionInput = z.infer<typeof devolucionSchema>;
export type ListarPedidosQuery = z.infer<typeof listarPedidosQuerySchema>;
