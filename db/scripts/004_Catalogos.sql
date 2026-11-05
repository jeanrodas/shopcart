/* ============================================================
   004_Catalogos.sql
   ShopCart - Datos de catalogo y configuracion base (idempotente).

   Proposito:
     - Sembrar los roles del sistema (Cliente, Operador, Administrador).
     - Sembrar los tipos de movimiento de inventario (kardex).
     - Sembrar los parametros de configuracion leidos por los SPs.
     - Crear el indice IX_Usuario_Rol.

   Orden de ejecucion: 004 (despues de 003_Security.sql).
   Idempotente: comprueba existencia antes de insertar/crear.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   Roles (en orden: Cliente, Operador, Administrador)
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE Nombre = N'Cliente')
    INSERT dbo.Rol (Nombre, Descripcion)
    VALUES (N'Cliente', N'Compra y consulta su propia informacion');

IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE Nombre = N'Operador')
    INSERT dbo.Rol (Nombre, Descripcion)
    VALUES (N'Operador', N'Gestiona pedidos e inventario');

IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE Nombre = N'Administrador')
    INSERT dbo.Rol (Nombre, Descripcion)
    VALUES (N'Administrador', N'Gestiona catalogo, precios, cupones, usuarios y reportes');
GO

/* ------------------------------------------------------------
   Tipos de movimiento de inventario
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimientoInventario WHERE Codigo = N'ENTRADA_COMPRA')
    INSERT dbo.TipoMovimientoInventario (Codigo, Nombre, Signo)
    VALUES (N'ENTRADA_COMPRA', N'Entrada por compra', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimientoInventario WHERE Codigo = N'SALIDA_VENTA')
    INSERT dbo.TipoMovimientoInventario (Codigo, Nombre, Signo)
    VALUES (N'SALIDA_VENTA', N'Salida por venta', -1);

IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimientoInventario WHERE Codigo = N'AJUSTE_POSITIVO')
    INSERT dbo.TipoMovimientoInventario (Codigo, Nombre, Signo)
    VALUES (N'AJUSTE_POSITIVO', N'Ajuste positivo', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimientoInventario WHERE Codigo = N'AJUSTE_NEGATIVO')
    INSERT dbo.TipoMovimientoInventario (Codigo, Nombre, Signo)
    VALUES (N'AJUSTE_NEGATIVO', N'Ajuste negativo', -1);

IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimientoInventario WHERE Codigo = N'DEVOLUCION')
    INSERT dbo.TipoMovimientoInventario (Codigo, Nombre, Signo)
    VALUES (N'DEVOLUCION', N'Devolucion de cliente', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimientoInventario WHERE Codigo = N'CANCELACION')
    INSERT dbo.TipoMovimientoInventario (Codigo, Nombre, Signo)
    VALUES (N'CANCELACION', N'Cancelacion de pedido', 1);
GO

/* ------------------------------------------------------------
   Parametros de configuracion
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'IVA_PORCENTAJE')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'IVA_PORCENTAJE', N'12', N'Porcentaje de IVA aplicado a la base imponible');

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'RESERVA_MINUTOS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'RESERVA_MINUTOS', N'15', N'Minutos de vigencia de una reserva de existencia');

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'CARRITO_ABANDONO_HORAS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'CARRITO_ABANDONO_HORAS', N'24', N'Horas para considerar abandonado un carrito activo');

/* Reaplicable: fuerza el valor a 25.00 aunque la fila ya exista (upsert idempotente). */
IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'COSTO_ENVIO')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'COSTO_ENVIO', N'25.00', N'Costo de envio por defecto');
ELSE
    UPDATE dbo.Parametro SET Valor = N'25.00'
     WHERE Clave = N'COSTO_ENVIO';

/* Umbral del lockout POR CUENTA en BD (capa 2). La capa 1 es un limitador en memoria
   por (correo + IP) en la API. Reaplicable: fuerza el valor a 10 aunque ya exista. */
IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'LOGIN_MAX_INTENTOS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'LOGIN_MAX_INTENTOS', N'10', N'Intentos fallidos de login antes de bloquear la cuenta');
ELSE
    UPDATE dbo.Parametro SET Valor = N'10'
     WHERE Clave = N'LOGIN_MAX_INTENTOS';

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'LOGIN_BLOQUEO_MINUTOS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'LOGIN_BLOQUEO_MINUTOS', N'15', N'Minutos de bloqueo de la cuenta tras superar los intentos');

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'STOCK_MINIMO', N'5', N'Umbral de disponible para marcar bajo stock');

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'RESERVA_JOB_SEGUNDOS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'RESERVA_JOB_SEGUNDOS', N'60', N'Intervalo del job de liberacion de reservas vencidas');
GO

/* ------------------------------------------------------------
   Indice de apoyo para listados de usuarios por rol
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Usuario_Rol' AND object_id = OBJECT_ID(N'dbo.Usuario'))
    CREATE NONCLUSTERED INDEX IX_Usuario_Rol ON dbo.Usuario (IDRol, Activo);
GO
