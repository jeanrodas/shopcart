/* ============================================================
   018_SP_Pedidos.sql
   ShopCart - Pedidos: ciclo de vida, cancelacion y devoluciones (RF-07).

   Reglas de negocio:
     - Las transiciones de estado permitidas son EXCLUSIVAMENTE las sembradas en
       dbo.TransicionEstadoPedido (015). El grafo:
           PAGADO -> EN_PREPARACION -> DESPACHADO -> ENTREGADO -> DEVUELTO
              |            |
              +----> CANCELADO <----+
     - Quien puede cada transicion (lo valida SP_Pedidos_CambiarEstado con el rol
       que le pasa la API):
         * Cliente: SOLO cancelar SU pedido, y solo desde PAGADO o EN_PREPARACION
           (transiciones con IDRolRequerido NULL y destino CANCELADO).
         * Operador: avanzar EN_PREPARACION / DESPACHADO / ENTREGADO y cancelar
           desde PAGADO / EN_PREPARACION.
         * Administrador: hereda todo lo del Operador.
         * DEVUELTO no se alcanza por CambiarEstado: solo via una devolucion.
     - Cancelar: por cada linea un movimiento CANCELACION (+Cantidad) via
       SP_Inventario_RegistrarMovimiento (@OrigenInterno = 1, @IDPedido,
       @SinResultado = 1), recorriendo las variantes en IDVariante ascendente y
       pre-bloqueadas (UPDLOCK, HOLDLOCK) antes del bucle de movimientos. Si el
       pedido tenia cupon: UsosActuales - 1 (nunca < 0) y DELETE de su CuponUso.
       El reembolso es simulado: solo se documenta, no hay tabla de reembolsos.
     - Devolucion: SOLO desde ENTREGADO, por Operador/Administrador. La entrada son
       lineas (dbo.TVP_DevolucionLinea). Se valida que cada linea pertenezca al
       pedido, Cantidad > 0, sin lineas repetidas y Cantidad + CantidadDevuelta <=
       Cantidad vendida (50422 con el SKU en el mensaje). Inserta Devolucion
       (MontoReintegrado = suma de MontoLinea) y DevolucionDetalle
       (MontoLinea prorrateado; la ultima unidad de la linea toma el remanente
       TotalLinea - montos previos, sin perder centavos); actualiza
       PedidoDetalle.CantidadDevuelta; y por cada linea un movimiento DEVOLUCION
       (+Cantidad) con el mismo patron de pre-bloqueo ascendente. Si tras la
       devolucion TODAS las lineas quedan con CantidadDevuelta = Cantidad, el pedido
       pasa ENTREGADO -> DEVUELTO (con historial); si es parcial, sigue ENTREGADO.
       Todo ocurre en una sola transaccion.
     - Cada cambio de estado inserta PedidoHistorialEstado con IDUsuario =
       @IDUsuarioEjecuta.
     - CANCELACION y DEVOLUCION (004) tienen Signo +1 y son internos en 011
       (@OrigenInterno = 1): este script los invoca solo asi.

   Convenciones: ver 016 (NOCOUNT + XACT_ABORT; sp_set_session_context con
   @IDUsuarioEjecuta como primera instruccion en los SPs que escriben; TRY/CATCH
   con ROLLBACK si @@TRANCOUNT > 0 y ';THROW;'; errores 50400-50499; mensajes en
   espanol sin acentos; cursores con limpieza via CURSOR_STATUS en el CATCH). Sin
   SQL dinamico. Montos DECIMAL(18,2). Variante.Existencia y Kardex SOLO los
   escribe SP_Inventario_RegistrarMovimiento.

   Orden de ejecucion M7: 018 (despues de 017). Reaplicable (CREATE OR ALTER; el
   TVP y el trigger se crean solo si no existen / con DROP previo el trigger).
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   TVP_DevolucionLinea: lineas a devolver (IDPedidoDetalle + Cantidad). Convencion
   propia TVP_<Nombre> (ver 008). CREATE TYPE no admite OR ALTER: se crea solo si
   no existe.
   ------------------------------------------------------------ */
IF NOT EXISTS (
        SELECT 1 FROM sys.table_types
        WHERE name = N'TVP_DevolucionLinea'
          AND schema_id = SCHEMA_ID(N'dbo'))
    CREATE TYPE dbo.TVP_DevolucionLinea AS TABLE (
        IDPedidoDetalle INT NOT NULL,
        Cantidad        INT NOT NULL
    );
GO

/* ------------------------------------------------------------
   SP_Pedidos_Obtener
   Solo lectura. Si @IDUsuario no es NULL (consulta de cliente) y el pedido no es
   suyo, responde 50404 uniforme (no revela existencia).
   Recordsets: (1) cabecera (estado + cliente), (2) detalle (con CantidadDevuelta),
   (3) historial, (4) devoluciones, (5) lineas de devolucion.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Obtener
    @IDPedido  INT,
    @IDUsuario INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Duenio INT = (SELECT IDUsuario FROM dbo.Pedido WHERE IDPedido = @IDPedido);

    IF @Duenio IS NULL
        THROW 50404, 'Pedido no encontrado', 1;
    IF @IDUsuario IS NOT NULL AND @Duenio <> @IDUsuario
        THROW 50404, 'Pedido no encontrado', 1;

    /* 1) Cabecera. */
    SELECT
        p.IDPedido, p.NumeroPedido, p.IDUsuario,
        u.Nombre AS ClienteNombre, u.Correo AS ClienteCorreo,
        ep.Codigo AS EstadoCodigo, ep.Nombre AS EstadoNombre,
        p.IDDireccion, p.DireccionEntrega,
        p.Subtotal, p.Descuento, p.CostoEnvio, p.Total,
        p.BaseImponible, p.IVA, p.PorcentajeIVA,
        p.IDCupon, cup.Codigo AS CuponCodigo,
        p.FechaCreacion, p.FechaActualizacion
    FROM dbo.Pedido p
    INNER JOIN dbo.Usuario u      ON u.IDUsuario = p.IDUsuario
    INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    LEFT JOIN  dbo.Cupon cup      ON cup.IDCupon = p.IDCupon
    WHERE p.IDPedido = @IDPedido;

    /* 2) Detalle. */
    SELECT
        pd.IDPedidoDetalle, pd.IDVariante, pd.SKU, pd.NombreProducto,
        pd.DescripcionVariante, pd.IDCategoria, pd.Cantidad, pd.PrecioUnitario,
        pd.DescuentoLinea, pd.TotalLinea, pd.CantidadDevuelta
    FROM dbo.PedidoDetalle pd
    WHERE pd.IDPedido = @IDPedido
    ORDER BY pd.IDVariante;

    /* 3) Historial de estados. */
    SELECT
        h.IDPedidoHistorialEstado,
        ea.Codigo AS EstadoAnteriorCodigo,
        en.Codigo AS EstadoNuevoCodigo, en.Nombre AS EstadoNuevoNombre,
        h.IDUsuario, usr.Nombre AS UsuarioNombre,
        h.Comentario, h.Fecha
    FROM dbo.PedidoHistorialEstado h
    LEFT JOIN  dbo.EstadoPedido ea ON ea.IDEstadoPedido = h.IDEstadoAnterior
    INNER JOIN dbo.EstadoPedido en ON en.IDEstadoPedido = h.IDEstadoNuevo
    INNER JOIN dbo.Usuario usr     ON usr.IDUsuario = h.IDUsuario
    WHERE h.IDPedido = @IDPedido
    ORDER BY h.Fecha, h.IDPedidoHistorialEstado;

    /* 4) Devoluciones. */
    SELECT d.IDDevolucion, d.Motivo, d.MontoReintegrado, d.Fecha,
           d.IDUsuario, usr.Nombre AS UsuarioNombre
    FROM dbo.Devolucion d
    INNER JOIN dbo.Usuario usr ON usr.IDUsuario = d.IDUsuario
    WHERE d.IDPedido = @IDPedido
    ORDER BY d.Fecha, d.IDDevolucion;

    /* 5) Lineas de devolucion. */
    SELECT dd.IDDevolucionDetalle, dd.IDDevolucion, dd.IDPedidoDetalle,
           pd.SKU, dd.Cantidad, dd.MontoLinea
    FROM dbo.DevolucionDetalle dd
    INNER JOIN dbo.Devolucion d    ON d.IDDevolucion = dd.IDDevolucion
    INNER JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = dd.IDPedidoDetalle
    WHERE d.IDPedido = @IDPedido
    ORDER BY dd.IDDevolucion, dd.IDDevolucionDetalle;
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_Listar
   Solo lectura. Filtros opcionales con el patron (@P IS NULL OR ...) + OPTION
   (RECOMPILE) para que cada combinacion use su propio plan sin SQL dinamico.
   @IDUsuario filtra por cliente (la API lo fija con el JWT del cliente; NULL para
   Operador/Admin salvo que filtren). @Texto busca en NumeroPedido o correo.
   Recordsets: (1) pagina, (2) Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Listar
    @IDUsuario    INT           = NULL,
    @CodigoEstado NVARCHAR(30)  = NULL,
    @Desde        DATETIME2(0)  = NULL,
    @Hasta        DATETIME2(0)  = NULL,
    @Texto        NVARCHAR(100) = NULL,
    @Pagina       INT           = 1,
    @TamanoPagina INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL OR @TamanoPagina < 1 SET @TamanoPagina = 20;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Patron NVARCHAR(102) = CASE WHEN @Texto IS NULL THEN NULL ELSE CONCAT(N'%', @Texto, N'%') END;

    ;WITH Filtrados AS (
        SELECT
            p.IDPedido, p.NumeroPedido, p.IDUsuario,
            u.Nombre AS ClienteNombre, u.Correo AS ClienteCorreo,
            ep.Codigo AS EstadoCodigo, ep.Nombre AS EstadoNombre,
            p.Total, p.FechaCreacion, p.FechaActualizacion
        FROM dbo.Pedido p
        INNER JOIN dbo.Usuario u       ON u.IDUsuario = p.IDUsuario
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        WHERE (@IDUsuario    IS NULL OR p.IDUsuario = @IDUsuario)
          AND (@CodigoEstado IS NULL OR ep.Codigo = @CodigoEstado)
          AND (@Desde        IS NULL OR p.FechaCreacion >= @Desde)
          AND (@Hasta        IS NULL OR p.FechaCreacion < @Hasta)
          AND (@Patron       IS NULL OR p.NumeroPedido LIKE @Patron OR u.Correo LIKE @Patron)
    )
    SELECT *
    FROM Filtrados
    ORDER BY FechaCreacion DESC, IDPedido DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS
    FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Pedido p
    INNER JOIN dbo.Usuario u       ON u.IDUsuario = p.IDUsuario
    INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    WHERE (@IDUsuario    IS NULL OR p.IDUsuario = @IDUsuario)
      AND (@CodigoEstado IS NULL OR ep.Codigo = @CodigoEstado)
      AND (@Desde        IS NULL OR p.FechaCreacion >= @Desde)
      AND (@Hasta        IS NULL OR p.FechaCreacion < @Hasta)
      AND (@Patron       IS NULL OR p.NumeroPedido LIKE @Patron OR u.Correo LIKE @Patron)
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_CambiarEstado
   Aplica una transicion de estado validada por el grafo y el rol. Si el destino es
   CANCELADO, ejecuta la logica de cancelacion (reponer inventario y devolver el
   uso del cupon). DEVUELTO se rechaza (solo via devolucion). Devuelve lo mismo que
   SP_Pedidos_Obtener.
   Errores: 50400 codigo de estado invalido; 50403 rol insuficiente; 50404 pedido
   inexistente o ajeno (cliente); 50409 transicion no permitida o destino DEVUELTO.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDPedido            INT,
    @CodigoEstadoDestino NVARCHAR(30),
    @Comentario          NVARCHAR(300) = NULL,
    @IDUsuarioEjecuta    INT,
    @RolEjecuta          NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Duenio INT, @IDEstadoOrigen INT, @CodigoOrigen NVARCHAR(30), @IDCupon INT,
            @IDEstadoDestino INT, @RequeridoRol NVARCHAR(30),
            @cvIDVariante INT, @cvCantidad INT, @Dummy INT, @Motivo NVARCHAR(300),
            @Msg NVARCHAR(300);

    BEGIN TRY
        BEGIN TRAN;

        /* Pedido bloqueado. */
        SELECT @Duenio = p.IDUsuario, @IDEstadoOrigen = p.IDEstadoPedido,
               @CodigoOrigen = ep.Codigo, @IDCupon = p.IDCupon
        FROM dbo.Pedido p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @Duenio IS NULL
            THROW 50404, 'Pedido no encontrado', 1;
        IF @RolEjecuta = N'Cliente' AND @Duenio <> @IDUsuarioEjecuta
            THROW 50404, 'Pedido no encontrado', 1;

        SELECT @IDEstadoDestino = IDEstadoPedido
        FROM dbo.EstadoPedido WHERE Codigo = @CodigoEstadoDestino;
        IF @IDEstadoDestino IS NULL
            THROW 50400, 'Codigo de estado destino invalido', 1;

        IF @CodigoEstadoDestino = N'DEVUELTO'
            THROW 50409, 'La transicion a DEVUELTO solo ocurre por una devolucion', 1;

        /* Transicion permitida en el grafo. */
        IF NOT EXISTS (
            SELECT 1 FROM dbo.TransicionEstadoPedido
            WHERE IDEstadoOrigen = @IDEstadoOrigen AND IDEstadoDestino = @IDEstadoDestino)
        BEGIN
            SET @Msg = CONCAT(N'Transicion no permitida de ', @CodigoOrigen, N' a ', @CodigoEstadoDestino);
            THROW 50409, @Msg, 1;
        END

        SELECT @RequeridoRol = r.Nombre
        FROM dbo.TransicionEstadoPedido t
        LEFT JOIN dbo.Rol r ON r.IDRol = t.IDRolRequerido
        WHERE t.IDEstadoOrigen = @IDEstadoOrigen AND t.IDEstadoDestino = @IDEstadoDestino;

        /* Autorizacion por rol (Admin hereda Operador; Cliente solo cancelar). */
        IF @RolEjecuta = N'Cliente'
        BEGIN
            IF NOT (@RequeridoRol IS NULL AND @CodigoEstadoDestino = N'CANCELADO')
                THROW 50403, 'El cliente solo puede cancelar su pedido', 1;
        END
        ELSE IF @RolEjecuta IN (N'Operador', N'Administrador')
        BEGIN
            IF NOT (@RequeridoRol IS NULL OR @RequeridoRol = N'Operador' OR @RolEjecuta = N'Administrador')
                THROW 50403, 'Rol insuficiente para la transicion', 1;
        END
        ELSE
            THROW 50403, 'Rol insuficiente para la transicion', 1;

        /* Cancelacion: reponer inventario y devolver el uso del cupon. */
        IF @CodigoEstadoDestino = N'CANCELADO'
        BEGIN
            /* Pre-bloqueo de variantes del pedido en IDVariante ascendente. */
            DECLARE cur_cancel_lock CURSOR LOCAL FAST_FORWARD FOR
                SELECT IDVariante FROM dbo.PedidoDetalle
                WHERE IDPedido = @IDPedido ORDER BY IDVariante;
            OPEN cur_cancel_lock;
            FETCH NEXT FROM cur_cancel_lock INTO @cvIDVariante;
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SELECT @Dummy = Existencia FROM dbo.Variante WITH (UPDLOCK, HOLDLOCK)
                WHERE IDVariante = @cvIDVariante;
                FETCH NEXT FROM cur_cancel_lock INTO @cvIDVariante;
            END
            CLOSE cur_cancel_lock;
            DEALLOCATE cur_cancel_lock;

            /* Movimiento CANCELACION (+Cantidad) por linea, en IDVariante ascendente. */
            DECLARE cur_cancel_mov CURSOR LOCAL FAST_FORWARD FOR
                SELECT IDVariante, Cantidad FROM dbo.PedidoDetalle
                WHERE IDPedido = @IDPedido ORDER BY IDVariante;
            OPEN cur_cancel_mov;
            FETCH NEXT FROM cur_cancel_mov INTO @cvIDVariante, @cvCantidad;
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @Motivo = CONCAT(N'Cancelacion pedido ', @IDPedido);
                EXEC dbo.SP_Inventario_RegistrarMovimiento
                    @IDVariante       = @cvIDVariante,
                    @CodigoTipo       = N'CANCELACION',
                    @Cantidad         = @cvCantidad,
                    @Motivo           = @Motivo,
                    @IDPedido         = @IDPedido,
                    @OrigenInterno    = 1,
                    @IDUsuarioEjecuta = @IDUsuarioEjecuta,
                    @SinResultado     = 1;
                FETCH NEXT FROM cur_cancel_mov INTO @cvIDVariante, @cvCantidad;
            END
            CLOSE cur_cancel_mov;
            DEALLOCATE cur_cancel_mov;

            /* Devolver el uso del cupon (reembolso simulado: solo se documenta). */
            IF @IDCupon IS NOT NULL
            BEGIN
                UPDATE dbo.Cupon WITH (UPDLOCK)
                   SET UsosActuales = CASE WHEN UsosActuales > 0 THEN UsosActuales - 1 ELSE 0 END,
                       FechaActualizacion = SYSUTCDATETIME()
                 WHERE IDCupon = @IDCupon;

                DELETE dbo.CuponUso WHERE IDPedido = @IDPedido;
            END
        END

        /* Aplicar la transicion y registrar el historial. */
        UPDATE dbo.Pedido
           SET IDEstadoPedido = @IDEstadoDestino,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDPedido = @IDPedido;

        INSERT dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario)
        VALUES (@IDPedido, @IDEstadoOrigen, @IDEstadoDestino, @IDUsuarioEjecuta, @Comentario);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF CURSOR_STATUS('local', 'cur_cancel_lock') >= 0 BEGIN CLOSE cur_cancel_lock; DEALLOCATE cur_cancel_lock; END;
        IF CURSOR_STATUS('local', 'cur_cancel_mov') >= 0 BEGIN CLOSE cur_cancel_mov; DEALLOCATE cur_cancel_mov; END;
        THROW;
    END CATCH

    EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido, @IDUsuario = NULL;
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_RegistrarDevolucion
   Solo desde ENTREGADO (lo exige la API con rol Operador/Admin). Valida las lineas
   del TVP, registra la devolucion y repone inventario (DEVOLUCION +Cantidad). Si
   todas las lineas quedan devueltas por completo, pasa el pedido a DEVUELTO.
   Devuelve lo mismo que SP_Pedidos_Obtener mas un recordset con la devolucion creada.
   Errores: 50404 pedido inexistente; 50409 el pedido no esta ENTREGADO;
   50422 lineas invalidas (ajenas, repetidas, cantidad <= 0 o mayor a lo vendido).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_RegistrarDevolucion
    @IDPedido         INT,
    @Motivo           NVARCHAR(300),
    @Lineas           dbo.TVP_DevolucionLinea READONLY,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Duenio INT, @CodigoEstado NVARCHAR(30), @IDEstadoOrigen INT, @IDEstadoDevuelto INT,
            @IDDevolucion INT, @SKUExcede NVARCHAR(50), @Pendientes INT,
            @dvIDVariante INT, @dvCantidad INT, @Dummy INT, @MotivoMov NVARCHAR(300),
            @Msg NVARCHAR(300);

    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) < 3
        THROW 50400, 'El motivo de la devolucion es obligatorio (3 a 300 caracteres)', 1;
    IF NOT EXISTS (SELECT 1 FROM @Lineas)
        THROW 50422, 'Debe indicar al menos una linea a devolver', 1;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Duenio = p.IDUsuario, @CodigoEstado = ep.Codigo, @IDEstadoOrigen = p.IDEstadoPedido
        FROM dbo.Pedido p WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;

        IF @Duenio IS NULL
            THROW 50404, 'Pedido no encontrado', 1;
        IF @CodigoEstado <> N'ENTREGADO'
            THROW 50409, 'Solo se puede registrar una devolucion de un pedido ENTREGADO', 1;

        /* Validaciones del TVP. */
        IF EXISTS (SELECT IDPedidoDetalle FROM @Lineas GROUP BY IDPedidoDetalle HAVING COUNT(1) > 1)
            THROW 50422, 'Hay lineas de devolucion repetidas', 1;
        IF EXISTS (SELECT 1 FROM @Lineas WHERE Cantidad IS NULL OR Cantidad <= 0)
            THROW 50422, 'La cantidad a devolver debe ser mayor a cero', 1;
        IF EXISTS (
            SELECT 1 FROM @Lineas l
            LEFT JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = l.IDPedidoDetalle AND pd.IDPedido = @IDPedido
            WHERE pd.IDPedidoDetalle IS NULL)
            THROW 50422, 'Una linea de devolucion no pertenece al pedido', 1;

        SELECT TOP (1) @SKUExcede = pd.SKU
        FROM @Lineas l
        INNER JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = l.IDPedidoDetalle
        WHERE l.Cantidad + pd.CantidadDevuelta > pd.Cantidad
        ORDER BY pd.IDVariante;

        IF @SKUExcede IS NOT NULL
        BEGIN
            SET @Msg = CONCAT(N'La cantidad a devolver del SKU ', @SKUExcede, N' excede lo vendido');
            THROW 50422, @Msg, 1;
        END

        /* Lineas resueltas (monto prorrateado por linea). La ULTIMA unidad devuelta de
           una linea (la que la deja completa) reintegra el remanente exacto
           TotalLinea - (suma de montos ya reintegrados de esa linea), para que la suma
           de las devoluciones iguale TotalLinea sin perder centavos por redondeo.
           Ej.: TotalLinea 10.00, 3 unidades, 3 devoluciones de 1 -> 3.33, 3.33, 3.34.
           prev.SumaMontos no incluye esta devolucion (aun no se inserto). */
        SELECT
            pd.IDPedidoDetalle,
            pd.IDVariante,
            l.Cantidad,
            CAST(
                CASE WHEN pd.CantidadDevuelta + l.Cantidad = pd.Cantidad
                     THEN pd.TotalLinea - ISNULL(prev.SumaMontos, 0)
                     ELSE ROUND(pd.TotalLinea * l.Cantidad / pd.Cantidad, 2)
                END AS DECIMAL(18,2)) AS MontoLinea
        INTO #DevLineas
        FROM @Lineas l
        INNER JOIN dbo.PedidoDetalle pd ON pd.IDPedidoDetalle = l.IDPedidoDetalle
        OUTER APPLY (
            SELECT SUM(dd.MontoLinea) AS SumaMontos
            FROM dbo.DevolucionDetalle dd
            WHERE dd.IDPedidoDetalle = pd.IDPedidoDetalle
        ) prev;

        /* Cabecera de la devolucion. */
        INSERT dbo.Devolucion (IDPedido, IDUsuario, Motivo, MontoReintegrado)
        VALUES (@IDPedido, @IDUsuarioEjecuta, LTRIM(RTRIM(@Motivo)),
                (SELECT ISNULL(SUM(MontoLinea), 0) FROM #DevLineas));
        SET @IDDevolucion = SCOPE_IDENTITY();

        INSERT dbo.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, Cantidad, MontoLinea)
        SELECT @IDDevolucion, IDPedidoDetalle, Cantidad, MontoLinea FROM #DevLineas;

        /* Acumular lo devuelto en el detalle del pedido. */
        UPDATE pd
           SET pd.CantidadDevuelta = pd.CantidadDevuelta + d.Cantidad
        FROM dbo.PedidoDetalle pd
        INNER JOIN #DevLineas d ON d.IDPedidoDetalle = pd.IDPedidoDetalle;

        /* Pre-bloqueo de variantes en IDVariante ascendente. */
        DECLARE cur_dev_lock CURSOR LOCAL FAST_FORWARD FOR
            SELECT IDVariante FROM #DevLineas ORDER BY IDVariante;
        OPEN cur_dev_lock;
        FETCH NEXT FROM cur_dev_lock INTO @dvIDVariante;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SELECT @Dummy = Existencia FROM dbo.Variante WITH (UPDLOCK, HOLDLOCK)
            WHERE IDVariante = @dvIDVariante;
            FETCH NEXT FROM cur_dev_lock INTO @dvIDVariante;
        END
        CLOSE cur_dev_lock;
        DEALLOCATE cur_dev_lock;

        /* Movimiento DEVOLUCION (+Cantidad) por linea, en IDVariante ascendente. */
        DECLARE cur_dev_mov CURSOR LOCAL FAST_FORWARD FOR
            SELECT IDVariante, Cantidad FROM #DevLineas ORDER BY IDVariante;
        OPEN cur_dev_mov;
        FETCH NEXT FROM cur_dev_mov INTO @dvIDVariante, @dvCantidad;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @MotivoMov = CONCAT(N'Devolucion pedido ', @IDPedido);
            EXEC dbo.SP_Inventario_RegistrarMovimiento
                @IDVariante       = @dvIDVariante,
                @CodigoTipo       = N'DEVOLUCION',
                @Cantidad         = @dvCantidad,
                @Motivo           = @MotivoMov,
                @IDPedido         = @IDPedido,
                @OrigenInterno    = 1,
                @IDUsuarioEjecuta = @IDUsuarioEjecuta,
                @SinResultado     = 1;
            FETCH NEXT FROM cur_dev_mov INTO @dvIDVariante, @dvCantidad;
        END
        CLOSE cur_dev_mov;
        DEALLOCATE cur_dev_mov;

        /* Si ya no quedan unidades pendientes, el pedido pasa a DEVUELTO. */
        SET @Pendientes = (SELECT COUNT(1) FROM dbo.PedidoDetalle
                           WHERE IDPedido = @IDPedido AND CantidadDevuelta < Cantidad);

        IF @Pendientes = 0
        BEGIN
            SET @IDEstadoDevuelto = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = N'DEVUELTO');

            UPDATE dbo.Pedido
               SET IDEstadoPedido = @IDEstadoDevuelto,
                   FechaActualizacion = SYSUTCDATETIME()
             WHERE IDPedido = @IDPedido;

            INSERT dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Comentario)
            VALUES (@IDPedido, @IDEstadoOrigen, @IDEstadoDevuelto, @IDUsuarioEjecuta, N'Devolucion total del pedido');
        END

        DROP TABLE #DevLineas;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF CURSOR_STATUS('local', 'cur_dev_lock') >= 0 BEGIN CLOSE cur_dev_lock; DEALLOCATE cur_dev_lock; END;
        IF CURSOR_STATUS('local', 'cur_dev_mov') >= 0 BEGIN CLOSE cur_dev_mov; DEALLOCATE cur_dev_mov; END;
        THROW;
    END CATCH

    EXEC dbo.SP_Pedidos_Obtener @IDPedido = @IDPedido, @IDUsuario = NULL;

    /* Recordset extra: la devolucion creada. */
    SELECT d.IDDevolucion, d.IDPedido, d.Motivo, d.MontoReintegrado, d.Fecha, d.IDUsuario
    FROM dbo.Devolucion d
    WHERE d.IDDevolucion = @IDDevolucion;
END
GO

/* ------------------------------------------------------------
   TR_Pedido_TransicionValida
   Respaldo en BD: ante un UPDATE directo de dbo.Pedido que cambie IDEstadoPedido a
   un par no presente en TransicionEstadoPedido, lanza 50409 y aborta. No aplica al
   INSERT (creacion del pedido) ni a updates que no cambian el estado.
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Pedido_TransicionValida
ON dbo.Pedido
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(IDEstadoPedido)
        RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN deleted d ON d.IDPedido = i.IDPedido
        WHERE i.IDEstadoPedido <> d.IDEstadoPedido
          AND NOT EXISTS (
              SELECT 1 FROM dbo.TransicionEstadoPedido t
              WHERE t.IDEstadoOrigen = d.IDEstadoPedido
                AND t.IDEstadoDestino = i.IDEstadoPedido
          )
    )
        THROW 50409, 'Transicion de estado de pedido no permitida', 1;
END
GO
