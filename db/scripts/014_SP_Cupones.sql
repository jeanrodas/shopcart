/* ============================================================
   014_SP_Cupones.sql
   ShopCart - Funciones y stored procedures de cupones y promociones (RF-05).

   Reglas de negocio (fijas):
     - Cupones solo para Cliente autenticado (el backend bloquea invitados con 401).
     - Un solo cupon por carrito: aplicar uno reemplaza el anterior.
     - Base elegible = subtotal de las lineas cuya Producto.IDCategoria coincide con
       Cupon.IDCategoria (si el cupon tiene categoria) o el subtotal completo.
         PORCENTAJE -> ROUND(base * Valor / 100, 2)
         MONTO      -> el menor entre Valor y base
       El descuento nunca supera el Subtotal del carrito.
     - El monto minimo se compara contra el Subtotal completo del carrito.
     - Validez evaluada EN ORDEN (primera causa que falla):
         1. no existe o Activo = 0           -> 50404 'Cupon invalido'
         2. FechaInicio > ahora              -> 50422 'El cupon aun no esta vigente'
         3. FechaFin < ahora                 -> 50422 'El cupon esta vencido'
         4. agotado (uso total)              -> 50422 'El cupon esta agotado'
         5. limite por cliente alcanzado     -> 50422 'Ya alcanzo el limite de usos de este cupon'
         6. Subtotal < MontoMinimo           -> 50422 'El carrito no alcanza el monto minimo ...'
         7. categoria con base elegible = 0  -> 50422 'El cupon no aplica a los productos del carrito'
     - M5 NO consume usos: nunca toca Cupon.UsosActuales ni inserta en CuponUso. Eso
       es del checkout (M6, dentro de su transaccion). M5 solo guarda Carrito.IDCupon.

   Convenciones: ver 005_SP_Auth.sql y 012_SP_Carrito.sql (NOCOUNT, TRY/CATCH + TRAN
   en escrituras, THROW 50400-50499 con status HTTP = numero - 50000, mensajes en
   espanol sin acentos, session context con @IDUsuarioEjecuta). Sin SQL dinamico.

   Dependencias: FU_Cupones_* son usadas por FU_Carrito_CalcularTotales (012), por lo
   que 014 se aplica ANTES de reaplicar 012. Las lee tambien SP_Carrito_Obtener (012)
   y SP_Cupones_Validar/AplicarACarrito (aqui).

   Orden de ejecucion M5: 013 -> 014 -> 012 (se reaplica) -> 099.
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   FU_Cupones_CalculoDescuento
   Funcion en linea (inline TVF): una sola fila con el calculo del descuento de un
   cupon sobre un carrito. NO valida vigencia ni limites: solo calcula montos.
   Si el cupon no existe devuelve el cupon en NULL y Descuento = 0.00.
   Columnas: IDCupon, Codigo, TipoDescuento, Valor, IDCategoria, Categoria,
             SubtotalCarrito, BaseElegible, Descuento. Todos los montos DECIMAL(18,2).
   ------------------------------------------------------------ */
CREATE OR ALTER FUNCTION dbo.FU_Cupones_CalculoDescuento (@IDCarrito INT, @IDCupon INT)
RETURNS TABLE
AS
RETURN
(
    WITH Cup AS (
        SELECT c.IDCupon, c.Codigo, c.TipoDescuento, c.Valor, c.IDCategoria,
               cat.Nombre AS Categoria
        FROM dbo.Cupon c
        LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
        WHERE c.IDCupon = @IDCupon
    ),
    Lineas AS (
        SELECT ROUND(v.Precio * cd.Cantidad, 2) AS TotalLinea,
               p.IDCategoria
        FROM dbo.CarritoDetalle cd
        INNER JOIN dbo.Variante v ON v.IDVariante = cd.IDVariante
        INNER JOIN dbo.Producto p ON p.IDProducto = v.IDProducto
        WHERE cd.IDCarrito = @IDCarrito
    ),
    CupCat AS (
        /* Categoria del cupon en una fila fija (NULL si el cupon no existe o no tiene
           categoria). Evita subconsultas dentro del SUM de abajo (error Msg 130). */
        SELECT MAX(IDCategoria) AS CatCupon FROM Cup
    ),
    Tot AS (
        SELECT
            CAST(ISNULL(SUM(l.TotalLinea), 0) AS DECIMAL(18,2)) AS SubtotalCarrito,
            CAST(ISNULL(SUM(
                     CASE WHEN cc.CatCupon IS NULL OR l.IDCategoria = cc.CatCupon
                          THEN l.TotalLinea ELSE 0 END), 0) AS DECIMAL(18,2)) AS BaseElegible
        FROM Lineas l
        CROSS JOIN CupCat cc
    )
    SELECT
        cu.IDCupon, cu.Codigo, cu.TipoDescuento, cu.Valor, cu.IDCategoria, cu.Categoria,
        t.SubtotalCarrito,
        t.BaseElegible,
        /* Descuento bruto acotado al Subtotal (nunca descuenta mas que el carrito). */
        CAST(CASE WHEN d.Bruto > t.SubtotalCarrito THEN t.SubtotalCarrito
                  WHEN d.Bruto < 0                  THEN 0
                  ELSE d.Bruto END AS DECIMAL(18,2)) AS Descuento
    FROM Tot t
    LEFT JOIN Cup cu ON 1 = 1
    CROSS APPLY (
        SELECT CAST(
            CASE
                WHEN cu.IDCupon IS NULL               THEN 0
                WHEN cu.TipoDescuento = N'PORCENTAJE' THEN ROUND(t.BaseElegible * cu.Valor / 100.0, 2)
                WHEN cu.Valor < t.BaseElegible        THEN cu.Valor
                ELSE t.BaseElegible
            END AS DECIMAL(18,2)) AS Bruto
    ) d
);
GO

/* ------------------------------------------------------------
   FU_Cupones_Estado
   Funcion en linea (inline TVF): una sola fila con Valido (BIT) y Causa
   (NVARCHAR(200), NULL si es valido), evaluando las reglas 1-7 en orden y
   devolviendo la primera causa que falla. Lee los usos por cliente de CuponUso.
   Se usa desde FU_Carrito_CalcularTotales, SP_Carrito_Obtener y SP_Cupones_Validar.
   ------------------------------------------------------------ */
CREATE OR ALTER FUNCTION dbo.FU_Cupones_Estado (@IDCarrito INT, @IDCupon INT, @IDUsuario INT)
RETURNS TABLE
AS
RETURN
(
    WITH Cup AS (
        SELECT c.IDCupon, c.Activo, c.FechaInicio, c.FechaFin,
               c.LimiteUsosTotal, c.UsosActuales, c.LimiteUsosPorCliente,
               c.MontoMinimo, c.IDCategoria
        FROM dbo.Cupon c
        WHERE c.IDCupon = @IDCupon
    ),
    Calc AS (
        SELECT SubtotalCarrito, BaseElegible
        FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon)
    ),
    UsosCliente AS (
        SELECT COUNT(1) AS Usos
        FROM dbo.CuponUso u
        WHERE u.IDCupon = @IDCupon AND u.IDUsuario = @IDUsuario
    ),
    Evaluacion AS (
        SELECT CASE
            WHEN c.IDCupon IS NULL OR c.Activo = 0
                 THEN N'Cupon invalido'
            WHEN c.FechaInicio > SYSUTCDATETIME()
                 THEN N'El cupon aun no esta vigente'
            WHEN c.FechaFin < SYSUTCDATETIME()
                 THEN N'El cupon esta vencido'
            WHEN c.LimiteUsosTotal IS NOT NULL AND c.UsosActuales >= c.LimiteUsosTotal
                 THEN N'El cupon esta agotado'
            WHEN c.LimiteUsosPorCliente IS NOT NULL AND uc.Usos >= c.LimiteUsosPorCliente
                 THEN N'Ya alcanzo el limite de usos de este cupon'
            WHEN calc.SubtotalCarrito < c.MontoMinimo
                 THEN CONCAT(N'El carrito no alcanza el monto minimo de Q ',
                             FORMAT(c.MontoMinimo, N'0.00'),
                             N' (faltan Q ',
                             FORMAT(c.MontoMinimo - calc.SubtotalCarrito, N'0.00'), N')')
            WHEN c.IDCategoria IS NOT NULL AND calc.BaseElegible = 0
                 THEN N'El cupon no aplica a los productos del carrito'
            ELSE NULL
        END AS Causa
        FROM Calc calc
        LEFT JOIN Cup c ON 1 = 1
        CROSS JOIN UsosCliente uc
    )
    SELECT
        CAST(CASE WHEN Causa IS NULL THEN 1 ELSE 0 END AS BIT) AS Valido,
        CAST(Causa AS NVARCHAR(200)) AS Causa
    FROM Evaluacion
);
GO

/* ------------------------------------------------------------
   SP_Cupones_Validar
   Valida un codigo contra el carrito activo del cliente, sin guardar nada.
   Parametros: @Codigo, @IDUsuario.
   Errores: 50422 'El carrito esta vacio' si el cliente no tiene carrito activo o
     esta vacio; 50404/50422 segun la regla que falle (ver encabezado).
   Devuelve: si es valido, la fila de FU_Cupones_CalculoDescuento.
   Solo lectura (sin TRAN ni session context).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Validar
    @Codigo    NVARCHAR(30),
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDCarrito INT, @NumLineas INT, @IDCupon INT,
            @Valido BIT, @Causa NVARCHAR(200), @Cod NVARCHAR(30);

    SET @Cod = UPPER(LTRIM(RTRIM(@Codigo)));

    SELECT @IDCarrito = IDCarrito
    FROM dbo.Carrito
    WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

    IF @IDCarrito IS NULL
        THROW 50422, 'El carrito esta vacio', 1;

    SELECT @NumLineas = COUNT(1) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;
    IF @NumLineas = 0
        THROW 50422, 'El carrito esta vacio', 1;

    SELECT @IDCupon = IDCupon FROM dbo.Cupon WHERE Codigo = @Cod;

    SELECT @Valido = Valido, @Causa = Causa
    FROM dbo.FU_Cupones_Estado(@IDCarrito, @IDCupon, @IDUsuario);

    IF @Valido = 0
    BEGIN
        IF @Causa = N'Cupon invalido'
            THROW 50404, @Causa, 1;
        THROW 50422, @Causa, 1;
    END

    SELECT IDCupon, Codigo, TipoDescuento, Valor, IDCategoria, Categoria,
           SubtotalCarrito, BaseElegible, Descuento
    FROM dbo.FU_Cupones_CalculoDescuento(@IDCarrito, @IDCupon);
END
GO

/* ------------------------------------------------------------
   SP_Cupones_AplicarACarrito
   Valida igual que SP_Cupones_Validar y, si pasa, guarda el cupon en el carrito
   (un solo cupon: reemplaza el anterior). No consume usos.
   Parametros: @Codigo, @IDUsuario, @IDUsuarioEjecuta.
   Devuelve: lo mismo que SP_Carrito_Obtener (el carrito con su cupon y totales).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_AplicarACarrito
    @Codigo           NVARCHAR(30),
    @IDUsuario        INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @IDCarrito INT, @NumLineas INT, @IDCupon INT,
            @Valido BIT, @Causa NVARCHAR(200), @Cod NVARCHAR(30);

    SET @Cod = UPPER(LTRIM(RTRIM(@Codigo)));

    BEGIN TRY
        BEGIN TRAN;

        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

        IF @IDCarrito IS NULL
            THROW 50422, 'El carrito esta vacio', 1;

        SELECT @NumLineas = COUNT(1) FROM dbo.CarritoDetalle WHERE IDCarrito = @IDCarrito;
        IF @NumLineas = 0
            THROW 50422, 'El carrito esta vacio', 1;

        SELECT @IDCupon = IDCupon FROM dbo.Cupon WHERE Codigo = @Cod;

        SELECT @Valido = Valido, @Causa = Causa
        FROM dbo.FU_Cupones_Estado(@IDCarrito, @IDCupon, @IDUsuario);

        IF @Valido = 0
        BEGIN
            IF @Causa = N'Cupon invalido'
                THROW 50404, @Causa, 1;
            THROW 50422, @Causa, 1;
        END

        UPDATE dbo.Carrito
           SET IDCupon = @IDCupon, FechaUltimaActividad = SYSUTCDATETIME()
         WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Cupones_QuitarDeCarrito
   Quita el cupon del carrito activo del cliente. No es error si no habia cupon ni
   si el cliente no tiene carrito activo.
   Parametros: @IDUsuario, @IDUsuarioEjecuta.
   Devuelve: lo mismo que SP_Carrito_Obtener.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_QuitarDeCarrito
    @IDUsuario        INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @IDCarrito INT;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @IDCarrito = IDCarrito
        FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
        WHERE IDUsuario = @IDUsuario AND Estado = N'Activo';

        IF @IDCarrito IS NOT NULL
            UPDATE dbo.Carrito
               SET IDCupon = NULL, FechaUltimaActividad = SYSUTCDATETIME()
             WHERE IDCarrito = @IDCarrito;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Carrito_Obtener @IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Cupones_Listar  (Administrador)
   Parametros: @Texto (LIKE sobre Codigo), @Activo (filtro), @SoloVigentes
     (activos y dentro de vigencia), @Pagina, @TamanoPagina (acotado 1-100).
   Devuelve: recordset 1 = cupones de la pagina (con Categoria y UsosActuales);
     recordset 2 = Total. Orden por FechaFin DESC.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Listar
    @Texto        NVARCHAR(50) = NULL,
    @Activo       BIT          = NULL,
    @SoloVigentes BIT          = 0,
    @Pagina       INT          = 1,
    @TamanoPagina INT          = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Patron NVARCHAR(52) = CASE WHEN @Texto IS NULL THEN NULL ELSE CONCAT(N'%', @Texto, N'%') END;
    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();

    SELECT c.IDCupon, c.Codigo, c.TipoDescuento, c.Valor, c.IDCategoria,
           cat.Nombre AS Categoria, c.MontoMinimo, c.FechaInicio, c.FechaFin,
           c.LimiteUsosTotal, c.LimiteUsosPorCliente, c.UsosActuales, c.Activo,
           c.FechaCreacion, c.FechaActualizacion
    INTO #Cupones
    FROM dbo.Cupon c
    LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
    WHERE (@Patron IS NULL OR c.Codigo LIKE @Patron)
      AND (@Activo IS NULL OR c.Activo = @Activo)
      AND (@SoloVigentes = 0
           OR (c.Activo = 1 AND c.FechaInicio <= @Ahora AND c.FechaFin >= @Ahora));

    SELECT IDCupon, Codigo, TipoDescuento, Valor, IDCategoria, Categoria,
           MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente,
           UsosActuales, Activo, FechaCreacion, FechaActualizacion
    FROM #Cupones
    ORDER BY FechaFin DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total FROM #Cupones;
END
GO

/* ------------------------------------------------------------
   SP_Cupones_Obtener  (Administrador)
   Parametros: @IDCupon.
   Errores: 50404 no existe.
   Devuelve: la fila del cupon (con Categoria) y el conteo real de usos (CuponUso).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Obtener
    @IDCupon INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 50404, 'Cupon no encontrado', 1;

    SELECT c.IDCupon, c.Codigo, c.TipoDescuento, c.Valor, c.IDCategoria,
           cat.Nombre AS Categoria, c.MontoMinimo, c.FechaInicio, c.FechaFin,
           c.LimiteUsosTotal, c.LimiteUsosPorCliente, c.UsosActuales, c.Activo,
           c.FechaCreacion, c.FechaActualizacion,
           (SELECT COUNT(1) FROM dbo.CuponUso u WHERE u.IDCupon = c.IDCupon) AS UsosRegistrados
    FROM dbo.Cupon c
    LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
    WHERE c.IDCupon = @IDCupon;
END
GO

/* ------------------------------------------------------------
   SP_Cupones_Crear  (Administrador)
   Parametros: @Codigo (se normaliza UPPER/TRIM), @TipoDescuento, @Valor,
     @IDCategoria, @MontoMinimo, @FechaInicio, @FechaFin, @LimiteUsosTotal,
     @LimiteUsosPorCliente, @IDUsuarioEjecuta.
   Errores: 50400 categoria inexistente o inactiva; codigo duplicado -> UQ (2627
     -> 409); el resto de invariantes las defiende el CHECK de la tabla (547 -> 409)
     y zod antes de llegar aqui.
   Devuelve: el cupon creado (via SP_Cupones_Obtener).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Crear
    @Codigo               NVARCHAR(30),
    @TipoDescuento        NVARCHAR(10),
    @Valor                DECIMAL(18,2),
    @IDCategoria          INT              = NULL,
    @MontoMinimo          DECIMAL(18,2)    = 0,
    @FechaInicio          DATETIME2(0),
    @FechaFin             DATETIME2(0),
    @LimiteUsosTotal      INT              = NULL,
    @LimiteUsosPorCliente INT              = NULL,
    @IDUsuarioEjecuta     INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Cod NVARCHAR(30) = UPPER(LTRIM(RTRIM(@Codigo)));
    DECLARE @NuevoID INT;

    IF @IDCategoria IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND Activo = 1)
        THROW 50400, 'La categoria no existe o no esta activa', 1;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo,
                          FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
        VALUES (@Cod, @TipoDescuento, @Valor, @IDCategoria, @MontoMinimo,
                @FechaInicio, @FechaFin, @LimiteUsosTotal, @LimiteUsosPorCliente);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Cupones_Actualizar  (Administrador)
   Parametros: @IDCupon + los mismos campos que Crear, @IDUsuarioEjecuta.
   Reglas: 50404 no existe; 50400 categoria inexistente/inactiva; si el cupon ya
     tiene usos (CuponUso o UsosActuales > 0) y se intenta cambiar Codigo,
     TipoDescuento, Valor o IDCategoria -> 50409 'No se puede modificar un cupon con
     usos'. Nunca escribe UsosActuales. Marca FechaActualizacion.
   Devuelve: el cupon actualizado (via SP_Cupones_Obtener).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Actualizar
    @IDCupon              INT,
    @Codigo               NVARCHAR(30),
    @TipoDescuento        NVARCHAR(10),
    @Valor                DECIMAL(18,2),
    @IDCategoria          INT              = NULL,
    @MontoMinimo          DECIMAL(18,2)    = 0,
    @FechaInicio          DATETIME2(0),
    @FechaFin             DATETIME2(0),
    @LimiteUsosTotal      INT              = NULL,
    @LimiteUsosPorCliente INT              = NULL,
    @IDUsuarioEjecuta     INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Cod NVARCHAR(30) = UPPER(LTRIM(RTRIM(@Codigo)));
    DECLARE @TieneUsos BIT, @CambiaClave BIT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 50404, 'Cupon no encontrado', 1;

    IF @IDCategoria IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND Activo = 1)
        THROW 50400, 'La categoria no existe o no esta activa', 1;

    SELECT @TieneUsos = CASE WHEN c.UsosActuales > 0
                                  OR EXISTS (SELECT 1 FROM dbo.CuponUso u WHERE u.IDCupon = @IDCupon)
                             THEN 1 ELSE 0 END,
           @CambiaClave = CASE WHEN c.Codigo <> @Cod
                                    OR c.TipoDescuento <> @TipoDescuento
                                    OR c.Valor <> @Valor
                                    OR ISNULL(c.IDCategoria, -1) <> ISNULL(@IDCategoria, -1)
                               THEN 1 ELSE 0 END
    FROM dbo.Cupon c
    WHERE c.IDCupon = @IDCupon;

    IF @TieneUsos = 1 AND @CambiaClave = 1
        THROW 50409, 'No se puede modificar un cupon con usos', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Cupon
           SET Codigo               = @Cod,
               TipoDescuento        = @TipoDescuento,
               Valor                = @Valor,
               IDCategoria          = @IDCategoria,
               MontoMinimo          = @MontoMinimo,
               FechaInicio          = @FechaInicio,
               FechaFin             = @FechaFin,
               LimiteUsosTotal      = @LimiteUsosTotal,
               LimiteUsosPorCliente = @LimiteUsosPorCliente,
               FechaActualizacion   = SYSUTCDATETIME()
         WHERE IDCupon = @IDCupon;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO

/* ------------------------------------------------------------
   SP_Cupones_CambiarEstado  (Administrador)
   Parametros: @IDCupon, @Activo, @IDUsuarioEjecuta.
   Errores: 50404 no existe. Baja/alta logica (Activo); marca FechaActualizacion.
   Devuelve: el cupon actualizado (via SP_Cupones_Obtener).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_CambiarEstado
    @IDCupon          INT,
    @Activo           BIT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE IDCupon = @IDCupon)
        THROW 50404, 'Cupon no encontrado', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Cupon
           SET Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
         WHERE IDCupon = @IDCupon;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Cupones_Obtener @IDCupon = @IDCupon;
END
GO
