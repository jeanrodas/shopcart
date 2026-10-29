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

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'COSTO_ENVIO')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'COSTO_ENVIO', N'0.00', N'Costo de envio por defecto');

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'LOGIN_MAX_INTENTOS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'LOGIN_MAX_INTENTOS', N'5', N'Intentos fallidos de login antes de bloquear la cuenta');

IF NOT EXISTS (SELECT 1 FROM dbo.Parametro WHERE Clave = N'LOGIN_BLOQUEO_MINUTOS')
    INSERT dbo.Parametro (Clave, Valor, Descripcion)
    VALUES (N'LOGIN_BLOQUEO_MINUTOS', N'15', N'Minutos de bloqueo de la cuenta tras superar los intentos');
GO

/* ------------------------------------------------------------
   Indice de apoyo para listados de usuarios por rol
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Usuario_Rol' AND object_id = OBJECT_ID(N'dbo.Usuario'))
    CREATE NONCLUSTERED INDEX IX_Usuario_Rol ON dbo.Usuario (IDRol, Activo);
GO
