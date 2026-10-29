import { type ISqlType, type IRecordSet } from 'mssql';
import { getPool } from '../config/db.js';
import { AppError, mapSqlError } from '../errors/index.js';

export interface SpParam {
  name: string;
  // Se omite para parametros de tipo tabla (TVP): el objeto sql.Table que se
  // pasa como `value` ya lleva su propio tipo y definicion de columnas.
  type?: ISqlType | (() => ISqlType);
  value: unknown;
  output?: boolean;
}

export interface SpResult<T> {
  recordset: T[];
  recordsets: IRecordSet<T>[];
  output: Record<string, unknown>;
  returnValue: number;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdentifier(name: string): void {
  if (!IDENTIFIER.test(name)) {
    // Validacion defensiva: los nombres de SP y parametros provienen del codigo,
    // nunca del cliente. No hay interpolacion de datos en ningun caso.
    throw new AppError(500, 'INTERNAL_ERROR', 'Error interno del servidor');
  }
}

/**
 * Ejecuta un stored procedure con parametros tipados. Unico punto de acceso a
 * datos: siempre request.execute(spName), nunca batch/query ni SQL en strings.
 *
 * Convencion de auditoria (bitacora): todo SP que escribe datos recibe
 * @IDUsuario INT como un parametro tipado mas y, en su primera instruccion,
 * ejecuta sp_set_session_context para publicar ese IDUsuario; los triggers de
 * bitacora lo leen con SESSION_CONTEXT(N'IDUsuario'). El backend no fija el
 * contexto: solo pasa @IDUsuario dentro de `params`.
 */
export async function executeSp<T = unknown>(
  spName: string,
  params: SpParam[],
): Promise<SpResult<T>> {
  assertIdentifier(spName);

  const pool = await getPool();
  const request = pool.request();

  for (const param of params) {
    assertIdentifier(param.name);
    if (param.output) {
      request.output(param.name, param.type as ISqlType | (() => ISqlType), param.value);
    } else if (param.type === undefined) {
      // Parametro de tipo tabla (TVP): `value` es un sql.Table ya construido.
      request.input(param.name, param.value);
    } else {
      request.input(param.name, param.type, param.value);
    }
  }

  try {
    const result = await request.execute<T>(spName);
    return {
      recordset: (result.recordset ?? []) as unknown as T[],
      recordsets: result.recordsets as IRecordSet<T>[],
      output: result.output,
      returnValue: result.returnValue,
    };
  } catch (err) {
    throw mapSqlError(err);
  }
}
