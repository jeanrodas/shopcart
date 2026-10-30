import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { executeSp, type SpParam } from '../data/spExecutor.js';

/** Identidad del carrito resuelta por el middleware cartIdentity. */
export interface CartIdentity {
  idUsuario?: number;
  tokenInvitado?: string;
}

interface CabeceraRow {
  IDCarrito: number | null;
  TokenInvitado: string | null;
  Estado: string | null;
  FechaUltimaActividad: string | null;
  Subtotal: number;
  Descuento: number;
  Total: number;
  PorcentajeIVA: number;
  BaseImponible: number;
  IVA: number;
  CantidadLineas: number;
  CantidadUnidades: number;
}

/** Fila del tercer recordset de SP_Carrito_Obtener (cupon aplicado, M5). */
interface CuponRow {
  IDCupon: number;
  Codigo: string;
  TipoDescuento: string;
  Valor: number;
  Categoria: string | null;
  BaseElegible: number;
  Descuento: number;
  Valido: boolean;
  Causa: string | null;
}

/** Cupon aplicado al carrito, con el detalle del descuento recalculado al mostrar. */
export interface CuponAplicado {
  IDCupon: number;
  Codigo: string;
  TipoDescuento: string;
  Valor: number;
  Categoria: string | null;
  descuento: {
    baseElegible: number;
    descuento: number;
    valido: boolean;
    causa: string | null;
  };
}

export interface CarritoResultado {
  carrito: unknown;
  lineas: unknown[];
  cupon: CuponAplicado | null;
  cartToken?: string;
}

/**
 * Arma la respuesta del carrito a partir de los recordsets de SP_Carrito_Obtener
 * (cabecera + totales, lineas y cupon). La exporta el servicio de cupones (M5),
 * cuyos SPs devuelven exactamente los mismos tres recordsets.
 */
export function ensamblarCarrito(recordsets: unknown[][], cartToken?: string): CarritoResultado {
  const cab = (recordsets[0]?.[0] ?? null) as CabeceraRow | null;
  const lineas = (recordsets[1] ?? []) as unknown[];
  const cuponRow = (recordsets[2]?.[0] ?? null) as CuponRow | null;

  let carrito: unknown = null;
  if (cab) {
    const {
      Subtotal,
      Descuento,
      Total,
      PorcentajeIVA,
      BaseImponible,
      IVA,
      CantidadLineas,
      CantidadUnidades,
      ...cabecera
    } = cab;
    carrito = {
      ...cabecera,
      totales: {
        Subtotal,
        Descuento,
        Total,
        PorcentajeIVA,
        BaseImponible,
        IVA,
        CantidadLineas,
        CantidadUnidades,
      },
    };
  }

  const cupon: CuponAplicado | null = cuponRow
    ? {
        IDCupon: cuponRow.IDCupon,
        Codigo: cuponRow.Codigo,
        TipoDescuento: cuponRow.TipoDescuento,
        Valor: cuponRow.Valor,
        Categoria: cuponRow.Categoria,
        descuento: {
          baseElegible: cuponRow.BaseElegible,
          descuento: cuponRow.Descuento,
          valido: Boolean(cuponRow.Valido),
          causa: cuponRow.Causa,
        },
      }
    : null;

  const resultado: CarritoResultado = { carrito, lineas, cupon };
  if (cartToken) {
    resultado.cartToken = cartToken;
  }
  return resultado;
}

/** @IDUsuarioEjecuta para la bitacora: el cliente autenticado, o NULL si invitado. */
function actor(id: CartIdentity): number | null {
  return id.idUsuario ?? null;
}

export async function obtener(id: CartIdentity): Promise<CarritoResultado> {
  const result = await executeSp('SP_Carrito_Obtener', [
    { name: 'IDUsuario', type: sql.Int, value: id.idUsuario ?? null },
    { name: 'TokenInvitado', type: sql.UniqueIdentifier, value: id.tokenInvitado ?? null },
  ]);
  return ensamblarCarrito(result.recordsets as unknown[][]);
}

export async function agregarItem(
  id: CartIdentity,
  idVariante: number,
  cantidad: number,
): Promise<CarritoResultado> {
  // Invitado sin token: el backend acuna el UUID y lo devuelve como cartToken.
  let tokenInvitado = id.tokenInvitado;
  let tokenGenerado: string | undefined;
  if (id.idUsuario === undefined && !tokenInvitado) {
    tokenInvitado = randomUUID();
    tokenGenerado = tokenInvitado;
  }

  const params: SpParam[] = [
    { name: 'IDUsuario', type: sql.Int, value: id.idUsuario ?? null },
    { name: 'TokenInvitado', type: sql.UniqueIdentifier, value: tokenInvitado ?? null },
    { name: 'IDVariante', type: sql.Int, value: idVariante },
    { name: 'Cantidad', type: sql.Int, value: cantidad },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actor(id) },
  ];
  // Solo se autoriza crear el carrito de invitado cuando acabamos de acunar el
  // token; un token recibido del cliente debe existir ya (si no, el SP responde 404).
  if (tokenGenerado) {
    params.push({ name: 'CrearSiNoExiste', type: sql.Bit, value: true });
  }

  const result = await executeSp('SP_Carrito_AgregarItem', params);
  return ensamblarCarrito(result.recordsets as unknown[][], tokenGenerado);
}

export async function actualizarItem(
  id: CartIdentity,
  idVariante: number,
  cantidad: number,
): Promise<CarritoResultado> {
  const result = await executeSp('SP_Carrito_ActualizarItem', [
    { name: 'IDUsuario', type: sql.Int, value: id.idUsuario ?? null },
    { name: 'TokenInvitado', type: sql.UniqueIdentifier, value: id.tokenInvitado ?? null },
    { name: 'IDVariante', type: sql.Int, value: idVariante },
    { name: 'Cantidad', type: sql.Int, value: cantidad },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actor(id) },
  ]);
  return ensamblarCarrito(result.recordsets as unknown[][]);
}

export async function eliminarItem(id: CartIdentity, idVariante: number): Promise<CarritoResultado> {
  const result = await executeSp('SP_Carrito_EliminarItem', [
    { name: 'IDUsuario', type: sql.Int, value: id.idUsuario ?? null },
    { name: 'TokenInvitado', type: sql.UniqueIdentifier, value: id.tokenInvitado ?? null },
    { name: 'IDVariante', type: sql.Int, value: idVariante },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actor(id) },
  ]);
  return ensamblarCarrito(result.recordsets as unknown[][]);
}

export async function vaciar(id: CartIdentity): Promise<CarritoResultado> {
  const result = await executeSp('SP_Carrito_Vaciar', [
    { name: 'IDUsuario', type: sql.Int, value: id.idUsuario ?? null },
    { name: 'TokenInvitado', type: sql.UniqueIdentifier, value: id.tokenInvitado ?? null },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actor(id) },
  ]);
  return ensamblarCarrito(result.recordsets as unknown[][]);
}
