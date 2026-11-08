import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { env } from '../config/env.js';
import { invalidarTodo } from '../utils/reportesCache.js';
import { emitir } from '../eventos/bus.js';
import type { PagarInput } from '../schemas/checkout.schema.js';

/** Fila de resumen de checkout (recordset 1 de Iniciar/Resumen). */
interface ResumenRow {
  IDCarrito: number | null;
  IDDireccion: number | null;
  DireccionTexto: string | null;
  Subtotal: number;
  Descuento: number;
  Total: number;
  PorcentajeIVA: number;
  BaseImponible: number;
  IVA: number;
  CantidadLineas: number;
  CantidadUnidades: number;
  CostoEnvio: number;
  TotalConEnvio: number;
  ExpiraEn: string | null;
  Minutos: number;
  ReservaActiva?: boolean;
}

/** Fila de cabecera del resultado de pago (recordset 1 de CrearPedido). */
interface PagoRow {
  Aprobado: boolean;
  IDPago: number;
  EstadoPago: string;
  MensajeResultado: string | null;
  ClaveIdempotencia: string;
  Monto: number | null;
  IDPedido: number | null;
  NumeroPedido: string | null;
  EstadoPedidoCodigo: string | null;
  EstadoPedidoNombre: string | null;
  FechaCreacion: string | null;
  DireccionEntrega: string | null;
  Subtotal: number | null;
  Descuento: number | null;
  CostoEnvio: number | null;
  Total: number | null;
  BaseImponible: number | null;
  IVA: number | null;
  PorcentajeIVA: number | null;
  CuponCodigo: string | null;
  NombreFactura: string | null;
  NITFactura: string | null;
}

export interface ResumenCheckout {
  resumen: unknown | null;
  lineas: unknown[];
}

export interface ResultadoPago {
  aprobado: boolean;
  replay: boolean;
  pago: {
    IDPago: number;
    Estado: string;
    MensajeResultado: string | null;
    ClaveIdempotencia: string;
    Monto: number | null;
  };
  pedido: {
    IDPedido: number;
    NumeroPedido: string | null;
    estado: { codigo: string | null; nombre: string | null };
    FechaCreacion: string | null;
    DireccionEntrega: string | null;
    totales: {
      Subtotal: number | null;
      Descuento: number | null;
      CostoEnvio: number | null;
      Total: number | null;
      BaseImponible: number | null;
      IVA: number | null;
      PorcentajeIVA: number | null;
    };
    cupon: string | null;
    NombreFactura: string | null;
    NITFactura: string | null;
  } | null;
  lineas: unknown[];
}

/** Arma el resumen de checkout (recordset 1 + lineas reservadas). */
function ensamblarResumen(recordsets: unknown[][]): ResumenCheckout {
  const fila = (recordsets[0]?.[0] ?? null) as ResumenRow | null;
  const lineas = (recordsets[1] ?? []) as unknown[];
  if (!fila || fila.IDCarrito === null) {
    return { resumen: null, lineas: [] };
  }

  const resumen: Record<string, unknown> = {
    IDCarrito: fila.IDCarrito,
    IDDireccion: fila.IDDireccion,
    DireccionTexto: fila.DireccionTexto,
    totales: {
      Subtotal: fila.Subtotal,
      Descuento: fila.Descuento,
      Total: fila.Total,
      PorcentajeIVA: fila.PorcentajeIVA,
      BaseImponible: fila.BaseImponible,
      IVA: fila.IVA,
      CantidadLineas: fila.CantidadLineas,
      CantidadUnidades: fila.CantidadUnidades,
    },
    CostoEnvio: fila.CostoEnvio,
    TotalConEnvio: fila.TotalConEnvio,
    ExpiraEn: fila.ExpiraEn,
    Minutos: fila.Minutos,
  };
  if (fila.ReservaActiva !== undefined) {
    resumen.ReservaActiva = Boolean(fila.ReservaActiva);
  }
  return { resumen, lineas };
}

export async function iniciar(idUsuario: number, idDireccion: number): Promise<ResumenCheckout> {
  const result = await executeSp('SP_Checkout_Iniciar', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'IDDireccion', type: sql.Int, value: idDireccion },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: idUsuario },
  ]);
  // La reserva cambia el disponible: invalida el cache de reportes.
  invalidarTodo();
  return ensamblarResumen(result.recordsets as unknown[][]);
}

export async function resumen(idUsuario: number): Promise<ResumenCheckout> {
  const result = await executeSp('SP_Checkout_Resumen', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
  ]);
  return ensamblarResumen(result.recordsets as unknown[][]);
}

export async function pagar(
  idUsuario: number,
  claveIdempotencia: string,
  datos: PagarInput,
  clienteNombre = '',
): Promise<ResultadoPago> {
  // El resultado del pago lo decide el backend, nunca el cliente. Con PAGO_SIMULADO
  // desactivado se ignora simularResultado del body y siempre se cobra APROBADO.
  const simularResultado = env.PAGO_SIMULADO ? datos.simularResultado : 'APROBADO';

  const result = await executeSp('SP_Pedidos_CrearPedido', [
    { name: 'IDUsuario', type: sql.Int, value: idUsuario },
    { name: 'IDDireccion', type: sql.Int, value: datos.idDireccion },
    { name: 'ClaveIdempotencia', type: sql.NVarChar(100), value: claveIdempotencia },
    { name: 'MetodoPago', type: sql.NVarChar(30), value: datos.metodoPago },
    { name: 'SimularResultado', type: sql.NVarChar(10), value: simularResultado },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: idUsuario },
    { name: 'NombreFactura', type: sql.NVarChar(150), value: datos.nombreFactura ?? null },
    { name: 'NITFactura', type: sql.NVarChar(20), value: datos.nitFactura ?? null },
  ]);

  const recordsets = result.recordsets as unknown[][];
  const cab = (recordsets[0]?.[0] ?? null) as PagoRow | null;
  const lineas = (recordsets[1] ?? []) as unknown[];
  const replay = Boolean((recordsets[2]?.[0] as { Replay?: boolean } | undefined)?.Replay);
  const aprobado = Boolean(cab?.Aprobado);

  // Un pedido aprobado NUEVO cambia ventas e inventario: emite pedido.creado (y
  // cupon.usado si uso cupon), que ademas invalida el cache de reportes via el bus.
  // Un replay no muta nada (idempotente), por eso no anuncia ni invalida.
  if (aprobado && !replay && cab) {
    emitir('pedido.creado', {
      idPedido: cab.IDPedido ?? 0,
      numero: cab.NumeroPedido ?? '',
      total: cab.Total ?? 0,
      cliente: clienteNombre,
      fecha: cab.FechaCreacion ?? new Date().toISOString(),
    });
    if (cab.CuponCodigo) {
      emitir('cupon.usado', { codigo: cab.CuponCodigo, numeroPedido: cab.NumeroPedido ?? '' });
    }
  }

  return {
    aprobado,
    replay,
    pago: {
      IDPago: cab?.IDPago ?? 0,
      Estado: cab?.EstadoPago ?? 'Desconocido',
      MensajeResultado: cab?.MensajeResultado ?? null,
      ClaveIdempotencia: cab?.ClaveIdempotencia ?? claveIdempotencia,
      // Monto intentado: un pago rechazado tambien lo reporta (no null).
      Monto: cab?.Monto ?? null,
    },
    pedido:
      aprobado && cab
        ? {
            IDPedido: cab.IDPedido as number,
            NumeroPedido: cab.NumeroPedido,
            estado: { codigo: cab.EstadoPedidoCodigo, nombre: cab.EstadoPedidoNombre },
            FechaCreacion: cab.FechaCreacion,
            DireccionEntrega: cab.DireccionEntrega,
            totales: {
              Subtotal: cab.Subtotal,
              Descuento: cab.Descuento,
              CostoEnvio: cab.CostoEnvio,
              Total: cab.Total,
              BaseImponible: cab.BaseImponible,
              IVA: cab.IVA,
              PorcentajeIVA: cab.PorcentajeIVA,
            },
            cupon: cab.CuponCodigo,
            NombreFactura: cab.NombreFactura,
            NITFactura: cab.NITFactura,
          }
        : null,
    lineas: aprobado ? lineas : [],
  };
}

export async function liberarVencidas(): Promise<{ liberadas: number }> {
  const result = await executeSp('SP_Checkout_LiberarReservasVencidas', []);
  const liberadas = (result.recordset[0] as { Liberadas: number } | undefined)?.Liberadas ?? 0;
  // Liberar reservas vencidas cambia el disponible: invalida el cache de reportes.
  if (liberadas > 0) invalidarTodo();
  return { liberadas };
}
