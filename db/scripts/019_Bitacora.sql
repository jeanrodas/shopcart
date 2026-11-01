/* ============================================================
   019_Bitacora.sql
   ShopCart - Bitacora de auditoria (RF-09).

   Requisito RF-09: toda creacion, modificacion o desactivacion en productos,
   precios, existencias, cupones y estados de pedido queda registrada con
   usuario, fecha, entidad, accion, valor anterior y valor nuevo; consultable
   por el Administrador con filtro por modulo; e inmutable (append-only).

   Como se captura al usuario:
     - Todo SP que escribe fija sp_set_session_context @key = N'IDUsuario' con el
       @IDUsuarioEjecuta como primera instruccion (ver 016/018). Los triggers de
       este script leen ese valor con TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS
       INT): queda NULL si no hay contexto (p. ej. el job de reservas, que ademas
       no escribe tablas auditadas).

   Que se audita y por que trigger (todos AFTER, set-based, sin cursores):
     - Producto  (CATALOGO):  INSERT -> CREAR; UPDATE -> MODIFICAR, salvo
                              Activo 1->0 -> DESACTIVAR. El UPDATE solo se registra
                              si cambio IDCategoria, Nombre, Descripcion o Activo.
     - Variante  (CATALOGO):  igual que Producto. El JSON lleva el precio (anterior
                              y nuevo). Si una fila SOLO cambia Existencia (la
                              escribe el kardex) NO se registra aqui: la existencia
                              se audita por Kardex.
     - Kardex    (INVENTARIO):INSERT -> CREAR; ValorNuevo = JSON del movimiento.
     - Cupon     (CUPONES):   INSERT -> CREAR; UPDATE -> MODIFICAR / DESACTIVAR.
                              El consumo de usos del checkout/cancelacion (solo
                              UsosActuales) NO se registra: no es un cambio de
                              gestion del cupon, analogo a la existencia del kardex.
     - PedidoHistorialEstado (PEDIDOS, IDEntidad = IDPedido): INSERT -> CREAR si no
                              hay estado anterior, si no MODIFICAR; ValorAnterior =
                              codigo del estado anterior, ValorNuevo = codigo nuevo.
     - Devolucion (PEDIDOS, IDEntidad = IDPedido): INSERT -> MODIFICAR; ValorNuevo =
                              JSON {IDDevolucion, Motivo, MontoReintegrado}.

   ValorAnterior/ValorNuevo: JSON (FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)
   con las columnas de negocio relevantes (excluye Fecha* y hashes), salvo
   PedidoHistorialEstado, que guarda el codigo del estado tal cual.

   Inmutabilidad en 3 capas (RF-09): (1) DENY UPDATE, DELETE a shopcart_app;
   (2) TR_Bitacora_Inmutable (003) INSTEAD OF UPDATE, DELETE lanza 50403 para
   cualquier principal; (3) ningun SP hace UPDATE/DELETE sobre dbo.Bitacora. Los
   triggers de aqui solo hacen INSERT, por lo que no chocan con esa regla ni con
   TR_Pedido_TransicionValida (018).

   Convenciones: ver 016/018 (NOCOUNT; XACT_ABORT en SPs con TRAN; session context
   con @IDUsuario; errores 50400-50499; mensajes sin acentos). Sin SQL dinamico;
   sin cursores. Montos DECIMAL(18,2).

   Orden de ejecucion M8: 019 (despues de 018). Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Bitacora_Registrar
   Helper interno para registrar una entrada puntual. El usuario sale del session
   context (NULL si no hay). El backend NO lo invoca: la auditoria ocurre por los
   triggers de abajo. Se deja disponible para registros manuales desde otros SPs.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Registrar
    @Modulo        NVARCHAR(50),
    @Entidad       NVARCHAR(100),
    @IDEntidad     INT,
    @Accion        NVARCHAR(20),
    @ValorAnterior NVARCHAR(MAX) = NULL,
    @ValorNuevo    NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    VALUES (@Modulo, @Entidad, @IDEntidad, @Accion, @ValorAnterior, @ValorNuevo,
            TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT));
END
GO

/* ------------------------------------------------------------
   TR_Producto_Bitacora  (CATALOGO / Producto)
   INSERT -> CREAR; UPDATE -> MODIFICAR salvo baja logica (Activo 1->0) -> DESACTIVAR.
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Producto_Bitacora
ON dbo.Producto
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    /* CREAR: filas que no existian (INSERT). */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'CATALOGO', N'Producto', i.IDProducto, N'CREAR',
           NULL,
           (SELECT i.IDCategoria, i.Nombre, i.Descripcion, i.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM deleted d WHERE d.IDProducto = i.IDProducto);

    /* MODIFICAR / DESACTIVAR: filas preexistentes (UPDATE). */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'CATALOGO', N'Producto', i.IDProducto,
           CASE WHEN d.Activo = 1 AND i.Activo = 0 THEN N'DESACTIVAR' ELSE N'MODIFICAR' END,
           (SELECT d.IDCategoria, d.Nombre, d.Descripcion, d.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           (SELECT i.IDCategoria, i.Nombre, i.Descripcion, i.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDProducto = i.IDProducto
    WHERE i.IDCategoria <> d.IDCategoria
       OR i.Nombre      <> d.Nombre
       OR ISNULL(i.Descripcion, N'') <> ISNULL(d.Descripcion, N'')
       OR i.Activo      <> d.Activo;
END
GO

/* ------------------------------------------------------------
   TR_Variante_Bitacora  (CATALOGO / Variante)
   INSERT -> CREAR; UPDATE -> MODIFICAR / DESACTIVAR. El JSON incluye el precio
   (anterior y nuevo). Excluye Existencia: si una fila SOLO cambio Existencia (y/o
   FechaActualizacion, lo escribe el kardex) NO se registra, se audita por Kardex.
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Variante_Bitacora
ON dbo.Variante
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    /* CREAR. */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'CATALOGO', N'Variante', i.IDVariante, N'CREAR',
           NULL,
           (SELECT i.IDProducto, i.SKU, i.Precio, i.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM deleted d WHERE d.IDVariante = i.IDVariante);

    /* MODIFICAR / DESACTIVAR, omitiendo los cambios que solo tocan Existencia. */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'CATALOGO', N'Variante', i.IDVariante,
           CASE WHEN d.Activo = 1 AND i.Activo = 0 THEN N'DESACTIVAR' ELSE N'MODIFICAR' END,
           (SELECT d.IDProducto, d.SKU, d.Precio, d.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           (SELECT i.IDProducto, i.SKU, i.Precio, i.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDVariante = i.IDVariante
    WHERE i.IDProducto <> d.IDProducto
       OR i.SKU        <> d.SKU
       OR i.Precio     <> d.Precio
       OR i.Activo     <> d.Activo;
END
GO

/* ------------------------------------------------------------
   TR_Kardex_Bitacora  (INVENTARIO / Kardex)
   El kardex es solo-insercion: cada movimiento genera un CREAR cuyo ValorNuevo es
   el JSON del movimiento (tipo, cantidad, existencia resultante, motivo, pedido).
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Kardex_Bitacora
ON dbo.Kardex
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'INVENTARIO', N'Kardex', i.IDKardex, N'CREAR',
           NULL,
           (SELECT t.Codigo              AS Tipo,
                   i.Cantidad            AS Cantidad,
                   i.ExistenciaResultante AS Existencia,
                   i.Motivo              AS Motivo,
                   i.IDPedido            AS IDPedido
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    INNER JOIN dbo.TipoMovimientoInventario t
            ON t.IDTipoMovimientoInventario = i.IDTipoMovimientoInventario;
END
GO

/* ------------------------------------------------------------
   TR_Cupon_Bitacora  (CUPONES / Cupon)
   INSERT -> CREAR; UPDATE -> MODIFICAR / DESACTIVAR (Activo 1->0). Se omite el
   cambio que solo mueve UsosActuales (consumo del checkout o devolucion del uso
   en la cancelacion): no es un cambio de gestion del cupon.
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Cupon_Bitacora
ON dbo.Cupon
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    /* CREAR. */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'CUPONES', N'Cupon', i.IDCupon, N'CREAR',
           NULL,
           (SELECT i.Codigo, i.TipoDescuento, i.Valor, i.IDCategoria, i.MontoMinimo,
                   i.FechaInicio, i.FechaFin, i.LimiteUsosTotal, i.LimiteUsosPorCliente, i.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM deleted d WHERE d.IDCupon = i.IDCupon);

    /* MODIFICAR / DESACTIVAR, omitiendo los cambios que solo tocan UsosActuales. */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'CUPONES', N'Cupon', i.IDCupon,
           CASE WHEN d.Activo = 1 AND i.Activo = 0 THEN N'DESACTIVAR' ELSE N'MODIFICAR' END,
           (SELECT d.Codigo, d.TipoDescuento, d.Valor, d.IDCategoria, d.MontoMinimo,
                   d.FechaInicio, d.FechaFin, d.LimiteUsosTotal, d.LimiteUsosPorCliente, d.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           (SELECT i.Codigo, i.TipoDescuento, i.Valor, i.IDCategoria, i.MontoMinimo,
                   i.FechaInicio, i.FechaFin, i.LimiteUsosTotal, i.LimiteUsosPorCliente, i.Activo
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDCupon = i.IDCupon
    WHERE i.Codigo        <> d.Codigo
       OR i.TipoDescuento <> d.TipoDescuento
       OR i.Valor         <> d.Valor
       OR ISNULL(i.IDCategoria, -1)          <> ISNULL(d.IDCategoria, -1)
       OR i.MontoMinimo   <> d.MontoMinimo
       OR i.FechaInicio   <> d.FechaInicio
       OR i.FechaFin      <> d.FechaFin
       OR ISNULL(i.LimiteUsosTotal, -1)      <> ISNULL(d.LimiteUsosTotal, -1)
       OR ISNULL(i.LimiteUsosPorCliente, -1) <> ISNULL(d.LimiteUsosPorCliente, -1)
       OR i.Activo        <> d.Activo;
END
GO

/* ------------------------------------------------------------
   TR_PedidoHistorialEstado_Bitacora  (PEDIDOS / Pedido)
   Cada fila de historial audita el pedido (IDEntidad = IDPedido). Sin estado
   anterior (creacion del pedido) -> CREAR; con estado anterior -> MODIFICAR.
   ValorAnterior/ValorNuevo = codigo del estado (no JSON).
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_PedidoHistorialEstado_Bitacora
ON dbo.PedidoHistorialEstado
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'PEDIDOS', N'Pedido', i.IDPedido,
           CASE WHEN i.IDEstadoAnterior IS NULL THEN N'CREAR' ELSE N'MODIFICAR' END,
           ea.Codigo,
           en.Codigo,
           @IDUsuario
    FROM inserted i
    LEFT JOIN  dbo.EstadoPedido ea ON ea.IDEstadoPedido = i.IDEstadoAnterior
    INNER JOIN dbo.EstadoPedido en ON en.IDEstadoPedido = i.IDEstadoNuevo;
END
GO

/* ------------------------------------------------------------
   TR_Devolucion_Bitacora  (PEDIDOS / Pedido)
   Una devolucion (total o parcial) es un cambio del pedido: INSERT -> MODIFICAR
   sobre el pedido (IDEntidad = IDPedido), con el detalle de la devolucion en el JSON.
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Devolucion_Bitacora
ON dbo.Devolucion
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'PEDIDOS', N'Pedido', i.IDPedido, N'MODIFICAR',
           NULL,
           (SELECT i.IDDevolucion, i.Motivo, i.MontoReintegrado
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i;
END
GO

/* ------------------------------------------------------------
   SP_Bitacora_Consultar  (Administrador)
   Solo lectura. Filtros opcionales con el patron (@P IS NULL OR ...) + OPTION
   (RECOMPILE). Orden Fecha DESC. Join a Usuario para correo/nombre.
   Recordsets: (1) pagina; (2) Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Consultar
    @Modulo       NVARCHAR(50)  = NULL,
    @Entidad      NVARCHAR(100) = NULL,
    @IDEntidad    INT           = NULL,
    @IDUsuario    INT           = NULL,
    @Accion       NVARCHAR(20)  = NULL,
    @Desde        DATETIME2(0)  = NULL,
    @Hasta        DATETIME2(0)  = NULL,
    @Pagina       INT           = 1,
    @TamanoPagina INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;

    SELECT b.IDBitacora, b.Modulo, b.Entidad, b.IDEntidad, b.Accion,
           b.ValorAnterior, b.ValorNuevo,
           b.IDUsuario, u.Correo AS UsuarioCorreo, u.Nombre AS UsuarioNombre,
           b.Fecha
    FROM dbo.Bitacora b
    LEFT JOIN dbo.Usuario u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo    IS NULL OR b.Modulo    = @Modulo)
      AND (@Entidad   IS NULL OR b.Entidad   = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@Accion    IS NULL OR b.Accion    = @Accion)
      AND (@Desde     IS NULL OR b.Fecha    >= @Desde)
      AND (@Hasta     IS NULL OR b.Fecha    <= @Hasta)
    ORDER BY b.Fecha DESC, b.IDBitacora DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Bitacora b
    WHERE (@Modulo    IS NULL OR b.Modulo    = @Modulo)
      AND (@Entidad   IS NULL OR b.Entidad   = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@Accion    IS NULL OR b.Accion    = @Accion)
      AND (@Desde     IS NULL OR b.Fecha    >= @Desde)
      AND (@Hasta     IS NULL OR b.Fecha    <= @Hasta)
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Bitacora_Modulos  (Administrador)
   Lista distinta de los modulos presentes en la bitacora (para el filtro).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Modulos
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT Modulo
    FROM dbo.Bitacora
    ORDER BY Modulo;
END
GO
