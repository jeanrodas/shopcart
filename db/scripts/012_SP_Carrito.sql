/* ============================================================
   012_SP_Carrito.sql
   ShopCart - Stored procedures del carrito de compras (RF-04).

   Reglas de negocio:
     - El carrito se identifica SIEMPRE por la identidad: @IDUsuario (cliente
       autenticado) o @TokenInvitado (UNIQUEIDENTIFIER). Nunca por un ID de
       carrito recibido del cliente. Solo se opera sobre carritos Estado = Activo.
     - El carrito NO reserva existencia: nunca escribe Variante.Existencia, Kardex
       ni Reserva. La reserva es del checkout (M6). Aqui solo se LEE el disponible.
     - Regla de bloqueo (de M3): todo SP que lee el disponible para decidir una
       escritura bloquea primero la fila de dbo.Variante WITH (UPDLOCK, HOLDLOCK)
       dentro de la transaccion, y despues consulta Reserva. Nunca al reves.
     - Precio vigente: el carrito usa Variante.Precio actual (se congela recien al
       crear el pedido, M6).

   Convenciones: ver 005_SP_Auth.sql y 011_SP_Inventario.sql (NOCOUNT, TRY/CATCH +
   TRAN en escrituras, THROW 50400-50499 con status HTTP = numero - 50000, mensajes
   en espanol sin acentos, session context con @IDUsuarioEjecuta). Sin SQL dinamico;
   los mensajes con numeros se arman con CONCAT.

   Orden de ejecucion: 012 (despues de 011_SP_Inventario.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   FU_Carrito_CalcularTotales
   Funcion en linea (inline TVF): una sola fila con los totales del carrito.
   Se invoca SOLO desde SPs del carrito, nunca desde el backend.
     TotalLinea     = ROUND(Precio * Cantidad, 2)
     Subtotal       = SUM(TotalLinea)
     Descuento      = 0.00 en M4 (M5 lo sustituye por el descuento del cupon)
     Total          = Subtotal - Descuento
     PorcentajeIVA  = Parametro IVA_PORCENTAJE (TRY_CAST, default 12), DECIMAL(5,2)
     BaseImponible  = ROUND(Total / (1 + IVA/100), 2)   (IVA incluido en el precio)
     IVA            = Total - BaseImponible
   Todos los montos DECIMAL(18,2). Si el carrito no tiene lineas (o @IDCarrito es
   NULL) devuelve ceros con el porcentaje de IVA vigente.
   ------------------------------------------------------------ */
CREATE OR ALTER FUNCTION dbo.FU_Carrito_CalcularTotales (@IDCarrito INT)
RETURNS TABLE
AS
RETURN
(
    WITH Lineas AS (
        SELECT cd.Cantidad,
               ROUND(v.Precio * cd.Cantidad, 2) AS TotalLinea
        FROM dbo.CarritoDetalle cd
        INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
        WHERE cd.IDCarrito = @IDCarrito
    ),
    Agg AS (
        SELECT CAST(ISNULL(SUM(TotalLinea), 0) AS DECIMAL(18,2)) AS Subtotal,
               COUNT(1)                        AS CantidadLineas,
               CAST(ISNULL(SUM(Cantidad), 0) AS INT) AS CantidadUnidades
        FROM Lineas
    ),
    Param AS (
        SELECT CAST(ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'IVA_PORCENTAJE') AS DECIMAL(5,2)), 12) AS DECIMAL(5,2)) AS PorcentajeIVA
    )
    SELECT
        a.Subtotal,
        CAST(0.00 AS DECIMAL(18,2))                                                    AS Descuento,
        CAST(a.Subtotal - 0.00 AS DECIMAL(18,2))                                       AS Total,
        p.PorcentajeIVA,
        CAST(ROUND((a.Subtotal - 0.00) / (1 + p.PorcentajeIVA / 100), 2) AS DECIMAL(18,2)) AS BaseImponible,
        CAST((a.Subtotal - 0.00) - ROUND((a.Subtotal - 0.00) / (1 + p.PorcentajeIVA / 100), 2) AS DECIMAL(18,2)) AS IVA,
        a.CantidadLineas,
        a.CantidadUnidades
    FROM Agg a
    CROSS JOIN Param p
);
GO

/* ------------------------------------------------------------
   SP_Carrito_Obtener
   Resuelve el carrito activo por usuario o por token (sin crear nada si no
   existe). Solo lectura.
   Parametros: @IDUsuario (cliente) o @TokenInvitado; si manda @IDUsuario se
   ignora @TokenInvitado (manda la identidad).
   Devuelve 3 recordsets:
     1) cabecera: IDCarrito (NULL si no existe), TokenInvitado, Estado,
        FechaUltimaActividad + columnas de FU_Carrito_CalcularTotales (siempre 1 fila).
     2) lineas del carrito con precio vigente, disponible, VarianteActiva y Advertencia.
     3) vacio reservado para M5 (cupon): columnas IDCupon, Codigo sin filas.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Obtener
    @IDUsuario      INT              = NULL,
    @TokenInvitado  UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCarrito INT;

    SELECT @IDCarrito = IDCarrito
    FROM dbo.Carrito
    WHERE Estado = N'Activo'
      AND ( (@IDUsuario IS NOT NULL AND IDUsuario = @IDUsuario)
         OR (@IDUsuario IS NULL AND @TokenInvitado IS NOT NULL AND TokenInvitado = @TokenInvitado) );

    /* 1) Cabecera + totales: siempre una fila (IDCarrito NULL si no existe). */
    SELECT
        c.IDCarrito,
        c.TokenInvitado,
        c.Estado,
        c.FechaUltimaActividad,
        t.Subtotal, t.Descuento, t.Total, t.PorcentajeIVA, t.BaseImponible, t.IVA,
        t.CantidadLineas, t.CantidadUnidades
    FROM (SELECT @IDCarrito AS IDCarrito) base
    LEFT JOIN dbo.Carrito c ON c.IDCarrito = @IDCarrito
    CROSS APPLY dbo.FU_Carrito_CalcularTotales(@IDCarrito) t;

    /* 2) Lineas. Advertencia: inactiva primero (bloqueo mas fuerte), luego falta
          de existencia; NULL si todo esta en orden. */
    SELECT
        cd.IDCarritoDetalle,
        cd.IDVariante,
        v.SKU,
        p.IDProducto,
        p.Nombre   AS Producto,
        cat.Nombre AS Categoria,
        img.Url    AS ImagenPrincipal,
        cd.Cantidad,
        v.Precio   AS PrecioUnitario,
        ROUND(v.Precio * cd.Cantidad, 2) AS TotalLinea,
        inv.Disponible,
        CAST(CASE WHEN v.Activo = 1 AND p.Activo = 1 AND cat.Activo = 1 THEN 1 ELSE 0 END AS BIT) AS VarianteActiva,
        CAST(CASE
                WHEN v.Activo = 0 OR p.Activo = 0 OR cat.Activo = 0 THEN N'No disponible para la venta'
                WHEN cd.Cantidad > inv.Disponible                   THEN N'Sin existencia suficiente'
                ELSE NULL
             END AS NVARCHAR(100)) AS Advertencia
    FROM dbo.CarritoDetalle cd
    INNER JOIN dbo.Variante v   ON v.IDVariante = cd.IDVariante
    INNER JOIN dbo.Producto p   ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.Categoria cat ON cat.IDCategoria = p.IDCategoria
    INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
    OUTER APPLY (
        SELECT TOP (1) pi.Url
        FROM dbo.ProductoImagen pi
        WHERE pi.IDProducto = p.IDProducto
        ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
    ) img
    WHERE cd.IDCarrito = @IDCarrito
    ORDER BY cd.IDCarritoDetalle;

    /* 3) Cupon aplicado (M5). Por ahora siempre vacio. */
    SELECT CAST(NULL AS INT) AS IDCupon, CAST(NULL AS NVARCHAR(30)) AS Codigo
    WHERE 1 = 0;
END
GO

/* ------------------------------------------------------------
   SP_Carrito_AgregarItem
   Agrega @Cantidad de una variante a la linea (suma a la existente). Resuelve o
   crea el carrito activo de la identidad.
   Parametros: @IDUsuario o @TokenInvitado (exactamente uno), @IDVariante,
     @Cantidad (1-1000), @IDUsuarioEjecuta (NULL para invitado),
     @CrearSiNoExiste (solo el servidor lo envia en 1, al acunar un token nuevo).
   Errores: 50400 identidad/cantidad invalida; 50404 variante no existe o carrito
     de invitado no encontrado (token desconocido sin @CrearSiNoExiste);
     50422 variante/producto/categoria inactivos o limite de 50 lineas;
     50409 carrito no activo o existencia disponible insuficiente.
   Devuelve: lo mismo que SP_Carrito_Obtener.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_AgregarItem
    @IDUsuario        INT              = NULL,
    @TokenInvitado    UNIQUEIDENTIFIER = NULL,
    @IDVariante       INT,
    @Cantidad         INT,
    @IDUsuarioEjecuta INT              = NULL,
    @CrearSiNoExiste  BIT              = 0
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF @IDUsuario IS NULL AND @TokenInvitado IS NULL
        THROW 50400, 'Debe venir el usuario autenticado o el token de invitado', 1;
    IF @IDUsuario IS NOT NULL AND @TokenInvitado IS NOT NULL
        THROW 50400, 'Solo se admite el usuario o el token de invitado, no ambos', 1;
    IF @Cantidad IS NULL OR @Cantidad < 1 OR @Cantidad > 1000
        THROW 50400, 'La cantidad debe estar entre 1 y 1000', 1;

    DECLARE @IDCarrito INT, @Estado NVARCHAR(20),
            @Existencia INT, @Reservado INT, @Disponible INT, @Activa BIT,
            @CantActual INT, @NuevaCantidad INT, @NumLineas INT, @Msg NVARCHAR(200);

    BEGIN TRY
        BEGIN TRAN;

        /* Resolver o crear el carrito activo de la identidad. */
        IF @IDUsuario IS NOT NULL
        BEGIN
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

            IF @IDCarrito IS NULL
            BEGIN
                INSERT dbo.Carrito (IDUsuario) VALUES (@IDUsuario);
                SET @IDCarrito = SCOPE_IDENTITY();
                SET @Estado = N'Activo';
            END
        END
        ELSE
        BEGIN
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE TokenInvitado = @TokenInvitado;

            /* El carrito de invitado solo se crea cuando el servidor acuna el
               token (@CrearSiNoExiste = 1). Un token desconocido no crea nada. */
            IF @IDCarrito IS NULL
            BEGIN
                IF @CrearSiNoExiste = 1
                BEGIN
                    INSERT dbo.Carrito (TokenInvitado) VALUES (@TokenInvitado);
                    SET @IDCarrito = SCOPE_IDENTITY();
                    SET @Estado = N'Activo';
                END
                ELSE
                    THROW 50404, 'Carrito no encontrado', 1;
            END
        END

        IF @Estado <> N'Activo'
            THROW 50409, 'El carrito ya no esta activo', 1;

        /* Bloquear la variante ANTES de leer el disponible (regla de M3). */
        SELECT @Existencia = v.Existencia,
               @Activa = CAST(CASE WHEN v.Activo = 1 AND p.Activo = 1 AND cat.Activo = 1 THEN 1 ELSE 0 END AS BIT)
        FROM dbo.Variante v WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Producto p    ON p.IDProducto = v.IDProducto
        INNER JOIN dbo.Categoria cat ON cat.IDCategoria = p.IDCategoria
        WHERE v.IDVariante = @IDVariante;

        IF @Existencia IS NULL
            THROW 50404, 'Variante no encontrada', 1;
        IF @Activa = 0
            THROW 50422, 'La variante no esta disponible para la venta', 1;

        SELECT @Reservado = ISNULL(SUM(r.Cantidad), 0)
        FROM dbo.Reserva r
        WHERE r.IDVariante = @IDVariante
          AND r.Estado = N'Activa'
          AND r.FechaExpira > SYSUTCDATETIME();

        SET @Disponible = @Existencia - @Reservado;

        SELECT @CantActual = Cantidad
        FROM dbo.CarritoDetalle
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
        SET @CantActual = ISNULL(@CantActual, 0);

        SET @NuevaCantidad = @CantActual + @Cantidad;

        IF @NuevaCantidad > 1000
            THROW 50400, 'La cantidad por linea no puede exceder 1000', 1;

        IF @NuevaCantidad > @Disponible
        BEGIN
            SET @Msg = CONCAT(N'Existencia disponible insuficiente: disponible ', @Disponible, N', solicitado ', @NuevaCantidad);
            THROW 50409, @Msg, 1;
        END

        /* Limite de 50 lineas: solo aplica cuando se agrega una linea nueva. */
        IF @CantActual = 0
        BEGIN
            SELECT @NumLineas = COUNT(1) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;
            IF @NumLineas >= 50
                THROW 50422, 'El carrito no puede tener mas de 50 lineas', 1;
        END

        IF @CantActual = 0
            INSERT dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
            VALUES (@IDCarrito, @IDVariante, @NuevaCantidad);
        ELSE
            UPDATE dbo.CarritoDetalle
               SET Cantidad = @NuevaCantidad
             WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito
           SET FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado;
END
GO

/* ------------------------------------------------------------
   SP_Carrito_ActualizarItem
   Fija la cantidad de una linea existente (no suma).
   Parametros: @IDUsuario o @TokenInvitado, @IDVariante, @Cantidad (1-1000),
     @IDUsuarioEjecuta.
   Errores: 50400 identidad/cantidad invalida; 50409 carrito no activo o
     disponible insuficiente; 50404 la variante no esta en el carrito o token de
     invitado desconocido; 50422 variante inactiva.
   Devuelve: lo mismo que SP_Carrito_Obtener.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ActualizarItem
    @IDUsuario        INT              = NULL,
    @TokenInvitado    UNIQUEIDENTIFIER = NULL,
    @IDVariante       INT,
    @Cantidad         INT,
    @IDUsuarioEjecuta INT              = NULL
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF @IDUsuario IS NULL AND @TokenInvitado IS NULL
        THROW 50400, 'Debe venir el usuario autenticado o el token de invitado', 1;
    IF @IDUsuario IS NOT NULL AND @TokenInvitado IS NOT NULL
        THROW 50400, 'Solo se admite el usuario o el token de invitado, no ambos', 1;
    IF @Cantidad IS NULL OR @Cantidad < 1 OR @Cantidad > 1000
        THROW 50400, 'La cantidad debe estar entre 1 y 1000', 1;

    DECLARE @IDCarrito INT, @Estado NVARCHAR(20),
            @Existencia INT, @Reservado INT, @Disponible INT, @Activa BIT, @Msg NVARCHAR(200);

    BEGIN TRY
        BEGIN TRAN;

        IF @IDUsuario IS NOT NULL
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';
        ELSE
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE TokenInvitado = @TokenInvitado;

        IF @IDCarrito IS NULL
        BEGIN
            /* Token de invitado desconocido: carrito inexistente. */
            IF @TokenInvitado IS NOT NULL
                THROW 50404, 'Carrito no encontrado', 1;
            THROW 50404, 'La variante no esta en el carrito', 1;
        END
        IF @Estado <> N'Activo'
            THROW 50409, 'El carrito ya no esta activo', 1;

        /* Bloquear la variante ANTES de leer el disponible (regla de M3). */
        SELECT @Existencia = v.Existencia,
               @Activa = CAST(CASE WHEN v.Activo = 1 AND p.Activo = 1 AND cat.Activo = 1 THEN 1 ELSE 0 END AS BIT)
        FROM dbo.Variante v WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Producto p    ON p.IDProducto = v.IDProducto
        INNER JOIN dbo.Categoria cat ON cat.IDCategoria = p.IDCategoria
        WHERE v.IDVariante = @IDVariante;

        IF NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
            THROW 50404, 'La variante no esta en el carrito', 1;

        IF @Activa = 0
            THROW 50422, 'La variante no esta disponible para la venta', 1;

        SELECT @Reservado = ISNULL(SUM(r.Cantidad), 0)
        FROM dbo.Reserva r
        WHERE r.IDVariante = @IDVariante
          AND r.Estado = N'Activa'
          AND r.FechaExpira > SYSUTCDATETIME();

        SET @Disponible = @Existencia - @Reservado;

        IF @Cantidad > @Disponible
        BEGIN
            SET @Msg = CONCAT(N'Existencia disponible insuficiente: disponible ', @Disponible, N', solicitado ', @Cantidad);
            THROW 50409, @Msg, 1;
        END

        UPDATE dbo.CarritoDetalle
           SET Cantidad = @Cantidad
         WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito
           SET FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado;
END
GO

/* ------------------------------------------------------------
   SP_Carrito_EliminarItem
   Elimina una linea del carrito. No lee disponible (no requiere lock de variante).
   Parametros: @IDUsuario o @TokenInvitado, @IDVariante, @IDUsuarioEjecuta.
   Errores: 50400 identidad invalida; 50409 carrito no activo; 50404 la variante
     no esta en el carrito o token de invitado desconocido.
   Devuelve: lo mismo que SP_Carrito_Obtener.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_EliminarItem
    @IDUsuario        INT              = NULL,
    @TokenInvitado    UNIQUEIDENTIFIER = NULL,
    @IDVariante       INT,
    @IDUsuarioEjecuta INT              = NULL
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF @IDUsuario IS NULL AND @TokenInvitado IS NULL
        THROW 50400, 'Debe venir el usuario autenticado o el token de invitado', 1;
    IF @IDUsuario IS NOT NULL AND @TokenInvitado IS NOT NULL
        THROW 50400, 'Solo se admite el usuario o el token de invitado, no ambos', 1;

    DECLARE @IDCarrito INT, @Estado NVARCHAR(20);

    BEGIN TRY
        BEGIN TRAN;

        IF @IDUsuario IS NOT NULL
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';
        ELSE
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE TokenInvitado = @TokenInvitado;

        IF @IDCarrito IS NULL
        BEGIN
            /* Token de invitado desconocido: carrito inexistente. */
            IF @TokenInvitado IS NOT NULL
                THROW 50404, 'Carrito no encontrado', 1;
            THROW 50404, 'La variante no esta en el carrito', 1;
        END
        IF @Estado <> N'Activo'
            THROW 50409, 'El carrito ya no esta activo', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante)
            THROW 50404, 'La variante no esta en el carrito', 1;

        DELETE dbo.CarritoDetalle
        WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;

        UPDATE dbo.Carrito
           SET FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado;
END
GO

/* ------------------------------------------------------------
   SP_Carrito_Vaciar
   Elimina todas las lineas; el carrito sigue Activo. Un usuario sin carrito
   activo devuelve el carrito vacio sin crear nada; un token de invitado
   desconocido es 50404.
   Parametros: @IDUsuario o @TokenInvitado, @IDUsuarioEjecuta.
   Errores: 50400 identidad invalida; 50404 token de invitado desconocido;
     50409 carrito no activo.
   Devuelve: lo mismo que SP_Carrito_Obtener.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Vaciar
    @IDUsuario        INT              = NULL,
    @TokenInvitado    UNIQUEIDENTIFIER = NULL,
    @IDUsuarioEjecuta INT              = NULL
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF @IDUsuario IS NULL AND @TokenInvitado IS NULL
        THROW 50400, 'Debe venir el usuario autenticado o el token de invitado', 1;
    IF @IDUsuario IS NOT NULL AND @TokenInvitado IS NOT NULL
        THROW 50400, 'Solo se admite el usuario o el token de invitado, no ambos', 1;

    DECLARE @IDCarrito INT, @Estado NVARCHAR(20);

    BEGIN TRY
        BEGIN TRAN;

        IF @IDUsuario IS NOT NULL
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';
        ELSE
            SELECT @IDCarrito = IDCarrito, @Estado = Estado
            FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
            WHERE TokenInvitado = @TokenInvitado;

        IF @IDCarrito IS NULL
        BEGIN
            /* Token de invitado desconocido: carrito inexistente. Un usuario sin
               carrito activo no es error (no hay nada que vaciar). */
            IF @TokenInvitado IS NOT NULL
                THROW 50404, 'Carrito no encontrado', 1;
        END
        ELSE
        BEGIN
            IF @Estado <> N'Activo'
                THROW 50409, 'El carrito ya no esta activo', 1;

            DELETE dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;

            UPDATE dbo.Carrito
               SET FechaUltimaActividad = SYSUTCDATETIME()
             WHERE IDCarrito = @IDCarrito;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @IDUsuario = @IDUsuario, @TokenInvitado = @TokenInvitado;
END
GO

/* ------------------------------------------------------------
   SP_Carrito_Fusionar
   Fusiona el carrito de invitado (por token) en el carrito activo del usuario al
   iniciar sesion o registrarse. Si el token no existe o el carrito invitado no
   esta Activo, no es error: devuelve ambos recordsets vacios.
   Las lineas se suman al carrito del usuario (creandolo si no existe), topando
   cada cantidad al disponible. El carrito invitado queda Convertido.
   Parametros: @TokenInvitado, @IDUsuario.
   Bloqueo: lock de cada variante (en orden de IDVariante para evitar deadlocks)
     antes de leer la reserva (regla de M3).
   Devuelve: recordset 1 = advertencias por linea topada (IDVariante, SKU,
     CantidadSolicitada, CantidadFinal, Motivo); recordset 2 = lineas fusionadas
     del carrito del usuario (IDVariante, SKU, Cantidad).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_Fusionar
    @TokenInvitado UNIQUEIDENTIFIER,
    @IDUsuario     INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

    DECLARE @Advertencias TABLE (
        IDVariante         INT,
        SKU                NVARCHAR(50),
        CantidadSolicitada INT,
        CantidadFinal      INT,
        Motivo             NVARCHAR(200)
    );

    DECLARE @IDCarritoInvitado INT, @EstadoInvitado NVARCHAR(20), @IDCarritoUsuario INT;
    DECLARE @IDVariante INT, @CantInvitado INT, @SKU NVARCHAR(50),
            @Existencia INT, @Reservado INT, @Disponible INT,
            @CantUsuario INT, @Solicitada INT, @Final INT, @Motivo NVARCHAR(200);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @IDCarritoInvitado = IDCarrito, @EstadoInvitado = Estado
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE TokenInvitado = @TokenInvitado;

        /* Nada que fusionar: no es error, se ignora. */
        IF @IDCarritoInvitado IS NULL OR @EstadoInvitado <> N'Activo'
        BEGIN
            COMMIT;

            SELECT IDVariante, SKU, CantidadSolicitada, CantidadFinal, Motivo
            FROM @Advertencias;

            SELECT CAST(NULL AS INT) AS IDVariante, CAST(NULL AS NVARCHAR(50)) AS SKU,
                   CAST(NULL AS INT) AS Cantidad
            WHERE 1 = 0;

            RETURN;
        END

        SELECT @IDCarritoUsuario = IDCarrito
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

        IF @IDCarritoUsuario IS NULL
        BEGIN
            INSERT dbo.Carrito (IDUsuario) VALUES (@IDUsuario);
            SET @IDCarritoUsuario = SCOPE_IDENTITY();
        END

        DECLARE cur_fusion CURSOR LOCAL FAST_FORWARD FOR
            SELECT cd.IDVariante, cd.Cantidad, v.SKU
            FROM dbo.CarritoDetalle cd
            INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
            WHERE cd.IDCarrito = @IDCarritoInvitado
            ORDER BY cd.IDVariante;

        OPEN cur_fusion;
        FETCH NEXT FROM cur_fusion INTO @IDVariante, @CantInvitado, @SKU;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            /* Bloquear la variante ANTES de leer la reserva (regla de M3). */
            SELECT @Existencia = Existencia
            FROM dbo.Variante WITH (UPDLOCK, HOLDLOCK)
            WHERE IDVariante = @IDVariante;

            SELECT @Reservado = ISNULL(SUM(r.Cantidad), 0)
            FROM dbo.Reserva r
            WHERE r.IDVariante = @IDVariante
              AND r.Estado = N'Activa'
              AND r.FechaExpira > SYSUTCDATETIME();

            SET @Disponible = @Existencia - @Reservado;

            SELECT @CantUsuario = Cantidad
            FROM dbo.CarritoDetalle
            WHERE IDCarrito = @IDCarritoUsuario AND IDVariante = @IDVariante;
            SET @CantUsuario = ISNULL(@CantUsuario, 0);

            SET @Solicitada = @CantUsuario + @CantInvitado;
            SET @Final = @Solicitada;
            IF @Final > 1000        SET @Final = 1000;
            IF @Final > @Disponible SET @Final = @Disponible;
            IF @Final < 0           SET @Final = 0;

            IF @Final > 0
            BEGIN
                IF @CantUsuario = 0
                    INSERT dbo.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
                    VALUES (@IDCarritoUsuario, @IDVariante, @Final);
                ELSE
                    UPDATE dbo.CarritoDetalle
                       SET Cantidad = @Final
                     WHERE IDCarrito = @IDCarritoUsuario AND IDVariante = @IDVariante;
            END

            IF @Final < @Solicitada
            BEGIN
                SET @Motivo = CASE WHEN @Final = 0
                                   THEN N'Sin existencia disponible; linea no agregada'
                                   ELSE CONCAT(N'Cantidad ajustada al disponible (', @Disponible, N')') END;
                INSERT @Advertencias (IDVariante, SKU, CantidadSolicitada, CantidadFinal, Motivo)
                VALUES (@IDVariante, @SKU, @Solicitada, @Final, @Motivo);
            END

            FETCH NEXT FROM cur_fusion INTO @IDVariante, @CantInvitado, @SKU;
        END

        CLOSE cur_fusion;
        DEALLOCATE cur_fusion;

        UPDATE dbo.Carrito
           SET Estado = N'Convertido', FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarritoInvitado;

        UPDATE dbo.Carrito
           SET FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarritoUsuario;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF CURSOR_STATUS('local', 'cur_fusion') >= 0
        BEGIN
            CLOSE cur_fusion;
            DEALLOCATE cur_fusion;
        END;
        THROW;
    END CATCH

    SELECT IDVariante, SKU, CantidadSolicitada, CantidadFinal, Motivo
    FROM @Advertencias
    ORDER BY IDVariante;

    SELECT cd.IDVariante, v.SKU, cd.Cantidad
    FROM dbo.CarritoDetalle cd
    INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
    WHERE cd.IDCarrito = @IDCarritoUsuario
    ORDER BY cd.IDVariante;
END
GO
