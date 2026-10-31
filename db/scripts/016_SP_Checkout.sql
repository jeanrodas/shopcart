/* ============================================================
   016_SP_Checkout.sql
   ShopCart - Checkout, reserva de existencia y creacion de pedido (RF-06).

   Flujo en dos pasos:
     1) SP_Checkout_Iniciar  -> reserva existencia por RESERVA_MINUTOS y devuelve
        un resumen con totales y costo de envio. Reiniciable: liberar reservas
        previas del carrito y volver a reservar.
     2) SP_Pedidos_CrearPedido -> cobra (pago simulado), consume las reservas,
        crea el pedido con su detalle, descuenta inventario por el kardex, registra
        el uso del cupon y deja el carrito Convertido. Idempotente por
        ClaveIdempotencia (UNIQUE en dbo.Pago) con replay identico.

   ORDEN DE BLOQUEO (obligatorio, anti-deadlock):
     Carrito (UPDLOCK, HOLDLOCK) -> Variante (UPDLOCK, HOLDLOCK, en IDVariante
     ascendente) -> Reserva -> Cupon (UPDLOCK). Nunca otro orden.
     En CrearPedido (rama aprobada) se bloquean PRIMERO todas las variantes del
     carrito en IDVariante ascendente (un SELECT ... WITH (UPDLOCK, HOLDLOCK) por
     cada una) y SOLO DESPUES se consumen las reservas y se registra el kardex. El
     pre-bloqueo es necesario: sin el, entre consumir la reserva (que la quita del
     disponible) y registrar la salida de venta, otro carrito podria reservar esa
     unidad y el pago fallaria. Con el, el orden Carrito -> Variante -> Reserva ->
     Cupon se cumple de forma literal y las variantes quedan retenidas hasta el
     COMMIT.

   SPs ANIDADOS: SP_Inventario_RegistrarMovimiento abre su propio BEGIN TRAN /
   COMMIT dentro de la transaccion exterior de CrearPedido (el COMMIT interno solo
   decrementa @@TRANCOUNT). Si un SP anidado lanza, su CATCH ya hizo ROLLBACK de
   TODO (el rollback va al nivel exterior) y relanza; el CATCH exterior encuentra
   @@TRANCOUNT = 0 y solo relanza. Se invoca con @SinResultado = 1 para que NO
   devuelva un result set por cada movimiento y asi no contaminar la salida.

   Convenciones: ver 005/011/012 (NOCOUNT, TRY/CATCH + TRAN en escrituras, THROW
   50400-50499 con HTTP = numero - 50000, mensajes en espanol sin acentos,
   session context con @IDUsuarioEjecuta). Sin SQL dinamico. Montos DECIMAL(18,2).
   Variante.Existencia y Kardex SOLO los escribe SP_Inventario_RegistrarMovimiento.

   Orden de ejecucion M6: 004 (reaplicar) -> 015 -> 016 -> 099 (si cambio).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Inventario_ReservarExistencia
   Interno: lo invoca SOLO SP_Checkout_Iniciar, DENTRO de su transaccion (no abre
   la suya). Libera las reservas Activa del carrito y crea reservas nuevas por
   cada linea, recorriendo las variantes en IDVariante ascendente y bloqueando
   cada una (UPDLOCK, HOLDLOCK). Disponible = Existencia - reservas Activa no
   vencidas de OTROS carritos. Si la cantidad excede el disponible lanza 50409 y
   el llamador revierte todo. Devuelve las reservas creadas, salvo que
   @SinResultado = 1 (el llamador las lee de dbo.Reserva y no quiere el result set).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ReservarExistencia
    @IDCarrito        INT,
    @Minutos          INT,
    @IDUsuarioEjecuta INT,
    @SinResultado     BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Expira DATETIME2(0) = DATEADD(MINUTE, @Minutos, SYSUTCDATETIME());

    DECLARE @IDVariante INT, @Cantidad INT, @SKU NVARCHAR(50),
            @Existencia INT, @Reservado INT, @Disponible INT, @Msg NVARCHAR(300);

    -- Corre DENTRO de la transaccion del llamador (no abre la suya ni revierte). El
    -- TRY/CATCH solo garantiza que el cursor quede cerrado y liberado si una linea
    -- lanza (p. ej. 50409); el rollback lo decide el llamador al relanzar el THROW.
    BEGIN TRY
        -- Libera reservas previas de ESTE carrito (reinicio del checkout).
        UPDATE dbo.Reserva
           SET Estado = N'Liberada'
         WHERE IDCarrito = @IDCarrito AND Estado = N'Activa';

        -- Recorrido en orden ascendente de IDVariante (anti-deadlock).
        DECLARE lineas CURSOR LOCAL FAST_FORWARD FOR
            SELECT cd.IDVariante, cd.Cantidad, v.SKU
            FROM dbo.CarritoDetalle cd
            INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
            WHERE cd.IDCarrito = @IDCarrito
            ORDER BY cd.IDVariante;

        OPEN lineas;
        FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad, @SKU;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Bloqueo de la variante.
            SELECT @Existencia = Existencia
            FROM dbo.Variante WITH (UPDLOCK, HOLDLOCK)
            WHERE IDVariante = @IDVariante;

            -- Reservas Activa no vencidas de OTROS carritos.
            SELECT @Reservado = ISNULL(SUM(r.Cantidad), 0)
            FROM dbo.Reserva r
            WHERE r.IDVariante = @IDVariante
              AND r.Estado = N'Activa'
              AND r.FechaExpira > SYSUTCDATETIME()
              AND r.IDCarrito <> @IDCarrito;

            SET @Disponible = @Existencia - @Reservado;

            IF @Cantidad > @Disponible
            BEGIN
                SET @Msg = CONCAT(N'Existencia insuficiente para SKU ', @SKU,
                                  N': disponible ', @Disponible, N', solicitado ', @Cantidad);
                THROW 50409, @Msg, 1;
            END

            INSERT dbo.Reserva (IDCarrito, IDVariante, Cantidad, Estado, FechaExpira)
            VALUES (@IDCarrito, @IDVariante, @Cantidad, N'Activa', @Expira);

            FETCH NEXT FROM lineas INTO @IDVariante, @Cantidad, @SKU;
        END

        CLOSE lineas;
        DEALLOCATE lineas;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'lineas') >= 0
        BEGIN
            CLOSE lineas;
            DEALLOCATE lineas;
        END;
        THROW;
    END CATCH

    -- Reservas creadas. Omitido cuando @SinResultado = 1 (el llamador las lee de
    -- dbo.Reserva), para no contaminar los result sets de salida.
    IF @SinResultado = 0
        SELECT r.IDReserva, r.IDVariante, v.SKU, r.Cantidad, r.FechaExpira
        FROM dbo.Reserva r
        INNER JOIN dbo.Variante v ON v.IDVariante = r.IDVariante
        WHERE r.IDCarrito = @IDCarrito AND r.Estado = N'Activa'
        ORDER BY r.IDVariante;
END
GO

/* ------------------------------------------------------------
   SP_Checkout_Iniciar
   Paso 1: valida carrito/direccion/cupon, reserva existencia y devuelve el
   resumen de checkout. Reiniciable (vuelve a reservar).
   Errores: 50422 carrito vacio / cupon no valido / variante inactiva (con SKU);
            50404 direccion inexistente o inactiva; 50403 direccion de otro usuario;
            50409 existencia insuficiente (desde ReservarExistencia).
   Devuelve: (1) resumen; (2) lineas reservadas.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Iniciar
    @IDUsuario        INT,
    @IDDireccion      INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @IDCarrito INT, @IDCupon INT, @NumLineas INT, @Minutos INT,
            @Valido BIT, @Causa NVARCHAR(200),
            @DirUsuario INT, @DirActivo BIT, @SKUInactivo NVARCHAR(50), @Msg NVARCHAR(300);

    SET @Minutos = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'RESERVA_MINUTOS') AS INT), 15);

    BEGIN TRY
        BEGIN TRAN;

        -- Carrito activo del usuario (bloqueado).
        SELECT @IDCarrito = IDCarrito, @IDCupon = IDCupon
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

        IF @IDCarrito IS NULL
            THROW 50422, 'El carrito esta vacio', 1;

        SELECT @NumLineas = COUNT(1) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;
        IF @NumLineas = 0
            THROW 50422, 'El carrito esta vacio', 1;

        -- Direccion del usuario.
        SELECT @DirUsuario = IDUsuario, @DirActivo = Activo
        FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;

        IF @DirUsuario IS NULL
            THROW 50404, 'Direccion no encontrada', 1;
        IF @DirUsuario <> @IDUsuario
            THROW 50403, 'La direccion no pertenece al usuario', 1;
        IF @DirActivo = 0
            THROW 50404, 'Direccion no encontrada', 1;

        -- Ninguna linea con variante/producto/categoria inactivos.
        SELECT TOP (1) @SKUInactivo = v.SKU
        FROM dbo.CarritoDetalle cd
        INNER JOIN dbo.Variante v   ON v.IDVariante = cd.IDVariante
        INNER JOIN dbo.Producto p   ON p.IDProducto = v.IDProducto
        INNER JOIN dbo.Categoria cat ON cat.IDCategoria = p.IDCategoria
        WHERE cd.IDCarrito = @IDCarrito
          AND (v.Activo = 0 OR p.Activo = 0 OR cat.Activo = 0)
        ORDER BY cd.IDVariante;

        IF @SKUInactivo IS NOT NULL
        BEGIN
            SET @Msg = CONCAT(N'El producto del SKU ', @SKUInactivo, N' ya no esta disponible para la venta');
            THROW 50422, @Msg, 1;
        END

        -- Cupon guardado: debe seguir siendo valido.
        IF @IDCupon IS NOT NULL
        BEGIN
            SELECT @Valido = Valido, @Causa = Causa
            FROM dbo.FU_Cupones_Estado(@IDCarrito, @IDCupon, @IDUsuario);
            IF @Valido = 0
                THROW 50422, @Causa, 1;
        END

        -- Reserva de existencia. @SinResultado = 1: no devuelve result set; las
        -- reservas creadas se leen abajo de dbo.Reserva.
        EXEC dbo.SP_Inventario_ReservarExistencia
            @IDCarrito        = @IDCarrito,
            @Minutos          = @Minutos,
            @IDUsuarioEjecuta = @IDUsuarioEjecuta,
            @SinResultado     = 1;

        UPDATE dbo.Carrito
           SET FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    DECLARE @CostoEnvio DECIMAL(18,2) =
        ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'COSTO_ENVIO') AS DECIMAL(18,2)), 0);
    DECLARE @ExpiraEn DATETIME2(0) = (
        SELECT MIN(FechaExpira) FROM dbo.Reserva
        WHERE IDCarrito = @IDCarrito AND Estado = N'Activa'
    );

    /* 1) Resumen. */
    SELECT
        @IDCarrito   AS IDCarrito,
        @IDDireccion AS IDDireccion,
        CONCAT_WS(N', ', d.NombreReceptor, d.Telefono, d.Linea1, d.Linea2,
                         d.Municipio, d.Departamento, d.CodigoPostal, d.Referencia) AS DireccionTexto,
        t.Subtotal, t.Descuento, t.Total, t.PorcentajeIVA,
        -- IVA sobre el total CON envio (el envio grava IVA), misma formula que CrearPedido.
        CAST(ROUND((t.Total + @CostoEnvio) / (1 + t.PorcentajeIVA / 100), 2) AS DECIMAL(18,2)) AS BaseImponible,
        CAST((t.Total + @CostoEnvio) - ROUND((t.Total + @CostoEnvio) / (1 + t.PorcentajeIVA / 100), 2) AS DECIMAL(18,2)) AS IVA,
        t.CantidadLineas, t.CantidadUnidades,
        @CostoEnvio AS CostoEnvio,
        CAST(t.Total + @CostoEnvio AS DECIMAL(18,2)) AS TotalConEnvio,
        @ExpiraEn AS ExpiraEn,
        @Minutos  AS Minutos
    FROM dbo.Direccion d
    CROSS APPLY dbo.FU_Carrito_CalcularTotales(@IDCarrito) t
    WHERE d.IDDireccion = @IDDireccion;

    /* 2) Lineas reservadas (leidas de dbo.Reserva, ya creadas por el SP interno). */
    SELECT r.IDVariante, v.SKU, r.Cantidad, r.FechaExpira
    FROM dbo.Reserva r
    INNER JOIN dbo.Variante v ON v.IDVariante = r.IDVariante
    WHERE r.IDCarrito = @IDCarrito AND r.Estado = N'Activa'
    ORDER BY r.IDVariante;
END
GO

/* ------------------------------------------------------------
   SP_Checkout_Resumen
   Solo lectura. Mismo formato de resumen que Iniciar, mas ReservaActiva (BIT:
   1 si TODAS las lineas tienen reserva Activa vigente con la misma cantidad).
   Carrito vacio o inexistente: result sets vacios, sin error.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_Resumen
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCarrito INT, @NumLineas INT;

    SELECT @IDCarrito = IDCarrito
    FROM dbo.Carrito
    WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

    SELECT @NumLineas = COUNT(1) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;

    IF @IDCarrito IS NULL OR @NumLineas = 0
    BEGIN
        -- Carrito vacio: dos result sets vacios, sin error.
        SELECT TOP (0)
            CAST(NULL AS INT) AS IDCarrito, CAST(NULL AS INT) AS IDDireccion,
            CAST(NULL AS NVARCHAR(600)) AS DireccionTexto,
            CAST(NULL AS DECIMAL(18,2)) AS Subtotal, CAST(NULL AS DECIMAL(18,2)) AS Descuento,
            CAST(NULL AS DECIMAL(18,2)) AS Total, CAST(NULL AS DECIMAL(5,2)) AS PorcentajeIVA,
            CAST(NULL AS DECIMAL(18,2)) AS BaseImponible, CAST(NULL AS DECIMAL(18,2)) AS IVA,
            CAST(NULL AS INT) AS CantidadLineas, CAST(NULL AS INT) AS CantidadUnidades,
            CAST(NULL AS DECIMAL(18,2)) AS CostoEnvio, CAST(NULL AS DECIMAL(18,2)) AS TotalConEnvio,
            CAST(NULL AS DATETIME2(0)) AS ExpiraEn, CAST(NULL AS INT) AS Minutos,
            CAST(NULL AS BIT) AS ReservaActiva;

        SELECT TOP (0)
            CAST(NULL AS INT) AS IDVariante, CAST(NULL AS NVARCHAR(50)) AS SKU,
            CAST(NULL AS INT) AS Cantidad, CAST(NULL AS DATETIME2(0)) AS FechaExpira;
        RETURN;
    END

    DECLARE @CostoEnvio DECIMAL(18,2) =
        ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'COSTO_ENVIO') AS DECIMAL(18,2)), 0);
    DECLARE @Minutos INT =
        ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'RESERVA_MINUTOS') AS INT), 15);

    -- Todas las lineas con reserva Activa vigente y cantidad igual.
    DECLARE @ReservaActiva BIT =
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM dbo.CarritoDetalle cd
            WHERE cd.IDCarrito = @IDCarrito
              AND NOT EXISTS (
                  SELECT 1 FROM dbo.Reserva r
                  WHERE r.IDCarrito = @IDCarrito AND r.IDVariante = cd.IDVariante
                    AND r.Estado = N'Activa' AND r.FechaExpira > SYSUTCDATETIME()
                    AND r.Cantidad = cd.Cantidad
              )
        ) THEN 1 ELSE 0 END;

    DECLARE @ExpiraEn DATETIME2(0) = (
        SELECT MIN(r.FechaExpira) FROM dbo.Reserva r
        WHERE r.IDCarrito = @IDCarrito AND r.Estado = N'Activa' AND r.FechaExpira > SYSUTCDATETIME()
    );

    /* 1) Resumen + ReservaActiva (sin direccion concreta: el resumen de solo
          lectura no fija direccion, se reporta NULL). */
    SELECT
        @IDCarrito AS IDCarrito,
        CAST(NULL AS INT) AS IDDireccion,
        CAST(NULL AS NVARCHAR(600)) AS DireccionTexto,
        t.Subtotal, t.Descuento, t.Total, t.PorcentajeIVA,
        -- IVA sobre el total CON envio (el envio grava IVA), misma formula que CrearPedido.
        CAST(ROUND((t.Total + @CostoEnvio) / (1 + t.PorcentajeIVA / 100), 2) AS DECIMAL(18,2)) AS BaseImponible,
        CAST((t.Total + @CostoEnvio) - ROUND((t.Total + @CostoEnvio) / (1 + t.PorcentajeIVA / 100), 2) AS DECIMAL(18,2)) AS IVA,
        t.CantidadLineas, t.CantidadUnidades,
        @CostoEnvio AS CostoEnvio,
        CAST(t.Total + @CostoEnvio AS DECIMAL(18,2)) AS TotalConEnvio,
        @ExpiraEn AS ExpiraEn,
        @Minutos  AS Minutos,
        @ReservaActiva AS ReservaActiva
    FROM dbo.FU_Carrito_CalcularTotales(@IDCarrito) t;

    /* 2) Lineas con reserva Activa vigente. */
    SELECT r.IDVariante, v.SKU, r.Cantidad, r.FechaExpira
    FROM dbo.Reserva r
    INNER JOIN dbo.Variante v ON v.IDVariante = r.IDVariante
    WHERE r.IDCarrito = @IDCarrito AND r.Estado = N'Activa' AND r.FechaExpira > SYSUTCDATETIME()
    ORDER BY r.IDVariante;
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_CrearPedido
   Paso 2: cobra (pago simulado) y, si aprueba, crea el pedido. Idempotente por
   ClaveIdempotencia con replay identico. Ver el encabezado del script para el
   orden de bloqueo y las transacciones anidadas.

   PAGO SIMULADO: el resultado lo decide el backend; al integrar una pasarela real,
   el SP recibe el resultado ya verificado por la pasarela, nunca uno enviado por el
   cliente.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CrearPedido
    @IDUsuario         INT,
    @IDDireccion       INT,
    @ClaveIdempotencia NVARCHAR(100),
    @MetodoPago        NVARCHAR(30),
    @SimularResultado  NVARCHAR(10),
    @IDUsuarioEjecuta  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    /* 1) Validacion de entrada. */
    IF @SimularResultado NOT IN (N'APROBADO', N'RECHAZADO')
        THROW 50400, 'SimularResultado debe ser APROBADO o RECHAZADO', 1;
    IF @MetodoPago NOT IN (N'TARJETA', N'TRANSFERENCIA', N'EFECTIVO')
        THROW 50400, 'MetodoPago debe ser TARJETA, TRANSFERENCIA o EFECTIVO', 1;

    DECLARE @IDCarrito INT, @IDCupon INT, @NumLineas INT,
            @IDPagoExistente INT, @PagoUsuario INT,
            @IDPago INT, @IDPedido INT, @Replay BIT = 0,
            @Valido BIT, @Causa NVARCHAR(200),
            @DirUsuario INT, @DirActivo BIT, @Msg NVARCHAR(300),
            @Subtotal DECIMAL(18,2), @Descuento DECIMAL(18,2), @CostoEnvio DECIMAL(18,2),
            @Total DECIMAL(18,2), @PorcentajeIVA DECIMAL(5,2),
            @BaseImponible DECIMAL(18,2), @IVA DECIMAL(18,2),
            @BaseElegible DECIMAL(18,2), @CuponCategoria INT,
            @IDEstadoPagado INT, @NumeroPedido NVARCHAR(20), @DireccionEntrega NVARCHAR(600),
            @SumDesc DECIMAL(18,2), @Resto DECIMAL(18,2),
            @Dummy INT, @vIDVariante INT, @vCantidad INT, @Motivo NVARCHAR(300);

    BEGIN TRY
        BEGIN TRAN;

        /* 2) Carrito activo del usuario (bloqueado). Puede no existir si ya se
              convirtio (replay). */
        SELECT @IDCarrito = IDCarrito, @IDCupon = IDCupon
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

        /* 3) Idempotencia: pago previo por clave (dentro del lock). */
        SELECT @IDPagoExistente = IDPago, @PagoUsuario = IDUsuario
        FROM dbo.Pago
        WHERE ClaveIdempotencia = @ClaveIdempotencia;

        IF @IDPagoExistente IS NOT NULL
        BEGIN
            IF @PagoUsuario <> @IDUsuario
                THROW 50409, 'Clave de idempotencia en uso', 1;

            -- Replay: mismo usuario, no se toca nada.
            SET @IDPago = @IDPagoExistente;
            SET @Replay = 1;
            COMMIT;
        END
        ELSE
        BEGIN
            IF @IDCarrito IS NULL
                THROW 50422, 'El carrito esta vacio', 1;

            SELECT @NumLineas = COUNT(1) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;
            IF @NumLineas = 0
                THROW 50422, 'El carrito esta vacio', 1;

            /* 4) Direccion del usuario. */
            SELECT @DirUsuario = IDUsuario, @DirActivo = Activo
            FROM dbo.Direccion WHERE IDDireccion = @IDDireccion;

            IF @DirUsuario IS NULL
                THROW 50404, 'Direccion no encontrada', 1;
            IF @DirUsuario <> @IDUsuario
                THROW 50403, 'La direccion no pertenece al usuario', 1;
            IF @DirActivo = 0
                THROW 50404, 'Direccion no encontrada', 1;

            /* 4) Todas las lineas con reserva Activa vigente y cantidad igual. */
            IF EXISTS (
                SELECT 1 FROM dbo.CarritoDetalle cd
                WHERE cd.IDCarrito = @IDCarrito
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.Reserva r
                      WHERE r.IDCarrito = @IDCarrito AND r.IDVariante = cd.IDVariante
                        AND r.Estado = N'Activa' AND r.FechaExpira > SYSUTCDATETIME()
                        AND r.Cantidad = cd.Cantidad
                  )
            )
                THROW 50409, 'La reserva vencio o no existe; inicie el checkout de nuevo', 1;

            /* 5) Cupon re-validado y totales. */
            IF @IDCupon IS NOT NULL
            BEGIN
                SELECT @Valido = Valido, @Causa = Causa
                FROM dbo.FU_Cupones_Estado(@IDCarrito, @IDCupon, @IDUsuario);
                IF @Valido = 0
                    THROW 50422, @Causa, 1;
            END

            /* (0) Pre-bloqueo de TODAS las variantes del carrito en IDVariante
               ascendente (orden Carrito -> Variante -> Reserva -> Cupon), ANTES de
               leer los totales, de construir #Lineas y de consumir las reservas. Se
               recorre dbo.CarritoDetalle porque #Lineas todavia no existe. Las
               variantes quedan retenidas hasta el COMMIT: sin esto, entre consumir la
               reserva (que la quita del disponible) y registrar la salida, otro
               carrito podria reservar esa unidad y el pago fallaria. */
            DECLARE bloqueo CURSOR LOCAL FAST_FORWARD FOR
                SELECT IDVariante FROM dbo.CarritoDetalle
                WHERE IDCarrito = @IDCarrito ORDER BY IDVariante;

            OPEN bloqueo;
            FETCH NEXT FROM bloqueo INTO @vIDVariante;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                SELECT @Dummy = Existencia
                FROM dbo.Variante WITH (UPDLOCK, HOLDLOCK)
                WHERE IDVariante = @vIDVariante;

                FETCH NEXT FROM bloqueo INTO @vIDVariante;
            END

            CLOSE bloqueo;
            DEALLOCATE bloqueo;

            /* (1) Totales y snapshot. */
            SELECT @Subtotal = Subtotal, @Descuento = Descuento, @PorcentajeIVA = PorcentajeIVA
            FROM dbo.FU_Carrito_CalcularTotales(@IDCarrito);

            SET @CostoEnvio = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'COSTO_ENVIO') AS DECIMAL(18,2)), 0);
            SET @Total = @Subtotal - @Descuento + @CostoEnvio;
            SET @BaseImponible = CAST(ROUND(@Total / (1 + @PorcentajeIVA / 100), 2) AS DECIMAL(18,2));
            SET @IVA = CAST(@Total - @BaseImponible AS DECIMAL(18,2));

            IF @SimularResultado = N'RECHAZADO'
            BEGIN
                /* 6) Pago rechazado: no hay pedido, las reservas quedan intactas. */
                INSERT dbo.Pago (IDCarrito, IDPedido, IDUsuario, ClaveIdempotencia, Monto,
                                 MetodoPago, Estado, MensajeResultado)
                VALUES (@IDCarrito, NULL, @IDUsuario, @ClaveIdempotencia, @Total,
                        @MetodoPago, N'Rechazado', N'Pago rechazado por la pasarela (simulado)');
                SET @IDPago = SCOPE_IDENTITY();
                SET @Replay = 0;
                COMMIT;
            END
            ELSE
            BEGIN
                /* 7) APROBADO. Snapshot de lineas y prorrateo del descuento. */
                SELECT @CuponCategoria = IDCategoria FROM dbo.Cupon WHERE IDCupon = @IDCupon;

                SELECT
                    cd.IDVariante,
                    v.SKU,
                    p.Nombre      AS NombreProducto,
                    p.IDCategoria AS IDCategoria,
                    cd.Cantidad,
                    v.Precio      AS PrecioUnitario,
                    CAST(ROUND(v.Precio * cd.Cantidad, 2) AS DECIMAL(18,2)) AS TotalBruta,
                    CAST(CASE WHEN @IDCupon IS NOT NULL
                                AND (@CuponCategoria IS NULL OR p.IDCategoria = @CuponCategoria)
                              THEN 1 ELSE 0 END AS BIT) AS EsElegible,
                    CAST(0 AS DECIMAL(18,2)) AS DescuentoLinea
                INTO #Lineas
                FROM dbo.CarritoDetalle cd
                INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
                INNER JOIN dbo.Producto p ON p.IDProducto = v.IDProducto
                WHERE cd.IDCarrito = @IDCarrito;

                SET @BaseElegible = (SELECT ISNULL(SUM(TotalBruta), 0) FROM #Lineas WHERE EsElegible = 1);

                -- Prorrateo proporcional sobre las lineas elegibles.
                IF @Descuento > 0 AND @BaseElegible > 0
                BEGIN
                    UPDATE #Lineas
                       SET DescuentoLinea = CAST(ROUND(@Descuento * TotalBruta / @BaseElegible, 2) AS DECIMAL(18,2))
                     WHERE EsElegible = 1;

                    -- La ultima linea elegible (mayor IDVariante) absorbe el redondeo.
                    SET @SumDesc = (SELECT ISNULL(SUM(DescuentoLinea), 0) FROM #Lineas);
                    SET @Resto = @Descuento - @SumDesc;

                    UPDATE #Lineas
                       SET DescuentoLinea = DescuentoLinea + @Resto
                     WHERE IDVariante = (SELECT MAX(IDVariante) FROM #Lineas WHERE EsElegible = 1);
                END

                /* Caso teorico de redondeo: ninguna linea puede quedar con descuento
                   negativo (el resto absorbido por la ultima linea elegible podria, en
                   teoria, volverla negativa). Se lleva a 0 antes del snapshot. */
                UPDATE #Lineas SET DescuentoLinea = 0 WHERE DescuentoLinea < 0;

                /* (2) Consumo de reservas ANTES del kardex (ver encabezado). El
                   pre-bloqueo de variantes (paso 0) ya dejo las variantes retenidas. */
                UPDATE dbo.Reserva
                   SET Estado = N'Consumida'
                 WHERE IDCarrito = @IDCarrito AND Estado = N'Activa'
                   AND FechaExpira > SYSUTCDATETIME();

                -- Debe consumirse exactamente una reserva vigente por cada linea del
                -- carrito; si no coincide, alguna expiro entre iniciar y pagar.
                IF @@ROWCOUNT <> @NumLineas
                    THROW 50409, 'La reserva de existencia expiro; inicie el checkout de nuevo', 1;

                /* Cabecera del pedido. */
                SET @IDEstadoPagado = (SELECT IDEstadoPedido FROM dbo.EstadoPedido WHERE Codigo = N'PAGADO');
                SET @NumeroPedido = CONCAT(N'SC-', FORMAT(NEXT VALUE FOR dbo.SEQ_Pedido_Numero, N'000000'));
                SET @DireccionEntrega = (
                    SELECT CONCAT_WS(N', ', d.NombreReceptor, d.Telefono, d.Linea1, d.Linea2,
                                            d.Municipio, d.Departamento, d.CodigoPostal, d.Referencia)
                    FROM dbo.Direccion d WHERE d.IDDireccion = @IDDireccion
                );

                INSERT dbo.Pedido (NumeroPedido, IDUsuario, IDEstadoPedido, IDDireccion, IDCupon,
                                   DireccionEntrega, Subtotal, Descuento, CostoEnvio, Total,
                                   BaseImponible, IVA, PorcentajeIVA)
                VALUES (@NumeroPedido, @IDUsuario, @IDEstadoPagado, @IDDireccion, @IDCupon,
                        @DireccionEntrega, @Subtotal, @Descuento, @CostoEnvio, @Total,
                        @BaseImponible, @IVA, @PorcentajeIVA);
                SET @IDPedido = SCOPE_IDENTITY();

                /* Detalle del pedido (snapshot). */
                INSERT dbo.PedidoDetalle (IDPedido, IDVariante, SKU, NombreProducto, DescripcionVariante,
                                          IDCategoria, Cantidad, PrecioUnitario, DescuentoLinea, TotalLinea)
                SELECT @IDPedido, l.IDVariante, l.SKU, l.NombreProducto, attr.Descripcion,
                       l.IDCategoria, l.Cantidad, l.PrecioUnitario, l.DescuentoLinea,
                       CAST(l.TotalBruta - l.DescuentoLinea AS DECIMAL(18,2))
                FROM #Lineas l
                OUTER APPLY (
                    SELECT STRING_AGG(CONCAT(va.Nombre, N': ', va.Valor), N', ')
                               WITHIN GROUP (ORDER BY va.Nombre) AS Descripcion
                    FROM dbo.VarianteAtributo va
                    WHERE va.IDVariante = l.IDVariante
                ) attr;

                /* Kardex por linea (orden ascendente de IDVariante). Las variantes
                   ya estan bloqueadas por el pre-bloqueo de arriba. Se invoca con
                   @SinResultado = 1 para no recibir un result set por movimiento. */
                DECLARE movs CURSOR LOCAL FAST_FORWARD FOR
                    SELECT IDVariante, Cantidad FROM #Lineas ORDER BY IDVariante;

                OPEN movs;
                FETCH NEXT FROM movs INTO @vIDVariante, @vCantidad;

                WHILE @@FETCH_STATUS = 0
                BEGIN
                    SET @Motivo = CONCAT(N'Venta pedido ', @NumeroPedido);

                    EXEC dbo.SP_Inventario_RegistrarMovimiento
                        @IDVariante       = @vIDVariante,
                        @CodigoTipo       = N'SALIDA_VENTA',
                        @Cantidad         = @vCantidad,
                        @Motivo           = @Motivo,
                        @IDPedido         = @IDPedido,
                        @OrigenInterno    = 1,
                        @IDUsuarioEjecuta = @IDUsuarioEjecuta,
                        @SinResultado     = 1;

                    FETCH NEXT FROM movs INTO @vIDVariante, @vCantidad;
                END

                CLOSE movs;
                DEALLOCATE movs;

                /* Uso del cupon (si hay). */
                IF @IDCupon IS NOT NULL
                BEGIN
                    UPDATE dbo.Cupon WITH (UPDLOCK)
                       SET UsosActuales = UsosActuales + 1,
                           FechaActualizacion = SYSUTCDATETIME()
                     WHERE IDCupon = @IDCupon
                       AND (LimiteUsosTotal IS NULL OR UsosActuales < LimiteUsosTotal);

                    IF @@ROWCOUNT = 0
                        THROW 50422, 'El cupon esta agotado', 1;

                    INSERT dbo.CuponUso (IDCupon, IDUsuario, IDPedido)
                    VALUES (@IDCupon, @IDUsuario, @IDPedido);
                END

                /* Pago aprobado. */
                INSERT dbo.Pago (IDCarrito, IDPedido, IDUsuario, ClaveIdempotencia, Monto,
                                 MetodoPago, Estado, MensajeResultado)
                VALUES (@IDCarrito, @IDPedido, @IDUsuario, @ClaveIdempotencia, @Total,
                        @MetodoPago, N'Aprobado', N'Pago aprobado (simulado)');
                SET @IDPago = SCOPE_IDENTITY();

                /* Carrito convertido. */
                UPDATE dbo.Carrito
                   SET Estado = N'Convertido', FechaUltimaActividad = SYSUTCDATETIME()
                 WHERE IDCarrito = @IDCarrito;

                /* Historial de estado inicial. */
                INSERT dbo.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo,
                                                  IDUsuario, Comentario)
                VALUES (@IDPedido, NULL, @IDEstadoPagado, @IDUsuario, N'Pedido creado con pago aprobado');

                SET @Replay = 0;
                COMMIT;
            END
        END
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF CURSOR_STATUS('local', 'bloqueo') >= 0
        BEGIN
            CLOSE bloqueo;
            DEALLOCATE bloqueo;
        END;
        IF CURSOR_STATUS('local', 'movs') >= 0
        BEGIN
            CLOSE movs;
            DEALLOCATE movs;
        END;
        THROW;
    END CATCH

    /* 9) Resultado (identico en primera ejecucion y en replay). */
    SELECT
        CAST(CASE WHEN pg.Estado = N'Aprobado' THEN 1 ELSE 0 END AS BIT) AS Aprobado,
        pg.IDPago,
        pg.Estado AS EstadoPago,
        pg.MensajeResultado,
        pg.ClaveIdempotencia,
        pg.Monto,
        pg.IDPedido,
        ped.NumeroPedido,
        ep.Codigo AS EstadoPedidoCodigo,
        ep.Nombre AS EstadoPedidoNombre,
        ped.FechaCreacion,
        ped.DireccionEntrega,
        ped.Subtotal, ped.Descuento, ped.CostoEnvio, ped.Total,
        ped.BaseImponible, ped.IVA, ped.PorcentajeIVA,
        cup.Codigo AS CuponCodigo
    FROM dbo.Pago pg
    LEFT JOIN dbo.Pedido ped       ON ped.IDPedido = pg.IDPedido
    LEFT JOIN dbo.EstadoPedido ep  ON ep.IDEstadoPedido = ped.IDEstadoPedido
    LEFT JOIN dbo.Cupon cup        ON cup.IDCupon = ped.IDCupon
    WHERE pg.IDPago = @IDPago;

    SELECT pd.IDPedidoDetalle, pd.IDVariante, pd.SKU, pd.NombreProducto, pd.DescripcionVariante,
           pd.IDCategoria, pd.Cantidad, pd.PrecioUnitario, pd.DescuentoLinea, pd.TotalLinea
    FROM dbo.PedidoDetalle pd
    INNER JOIN dbo.Pago pg ON pg.IDPedido = pd.IDPedido
    WHERE pg.IDPago = @IDPago
    ORDER BY pd.IDVariante;

    SELECT @Replay AS Replay;
END
GO

/* ------------------------------------------------------------
   SP_Checkout_LiberarReservasVencidas
   Job periodico: marca Liberada toda reserva Activa vencida. Sin session context
   (lo ejecuta el job, actor NULL). Devuelve Liberadas = cantidad afectada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_LiberarReservasVencidas
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Reserva
       SET Estado = N'Liberada'
     WHERE Estado = N'Activa' AND FechaExpira <= SYSUTCDATETIME();

    SELECT @@ROWCOUNT AS Liberadas;
END
GO
