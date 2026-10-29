/* ============================================================
   011_SP_Inventario.sql
   ShopCart - Stored procedures de inventario y kardex (RF-03).

   Reglas de negocio:
     - Variante.Existencia SOLO la modifica SP_Inventario_RegistrarMovimiento.
       Ningun otro SP de ningun modulo hace UPDATE sobre esa columna.
     - Invariante: Existencia = SUM(Signo * Cantidad) del kardex de la variante.
       Cada fila de Kardex guarda ExistenciaResultante.
     - Tipos expuestos a la API: ENTRADA_COMPRA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO.
       SALIDA_VENTA, DEVOLUCION y CANCELACION son internos (pedidos): solo se
       permiten con @OrigenInterno = 1; el backend nunca lo envia.
     - Un movimiento negativo no puede dejar la existencia fisica < 0 ni el
       disponible (existencia - reservas activas no vencidas) < 0.

   Convenciones: ver 005_SP_Auth.sql (NOCOUNT, TRY/CATCH + TRAN en escrituras,
   THROW 50400-50499, session context con @IDUsuarioEjecuta). Sin SQL dinamico;
   mensajes con numeros construidos con CONCAT (no concatenacion de comandos).

   Orden de ejecucion: 011 (despues de 010_SP_Catalogo.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Inventario_RegistrarMovimiento
   Unico punto que modifica Variante.Existencia y escribe en Kardex.
   Parametros:
     @IDVariante, @CodigoTipo, @Cantidad (>0), @Motivo (3-300),
     @IDPedido (NULL salvo movimientos internos de pedido),
     @OrigenInterno (1 solo desde SPs de pedidos), @IDUsuarioEjecuta.
   Errores:
     50400 tipo invalido / cantidad invalida / motivo invalido;
     50403 tipo reservado al sistema (SALIDA_VENTA/DEVOLUCION/CANCELACION con
            @OrigenInterno = 0);
     50404 variante no encontrada;
     50422 existencia insuficiente o disponible reservado insuficiente.
   Devuelve: la fila de kardex creada + Existencia, Reservado, Disponible.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarMovimiento
    @IDVariante       INT,
    @CodigoTipo       NVARCHAR(30),
    @Cantidad         INT,
    @Motivo           NVARCHAR(300),
    @IDPedido         INT = NULL,
    @OrigenInterno    BIT = 0,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @IDTipo INT, @Signo SMALLINT;
    SELECT @IDTipo = IDTipoMovimientoInventario, @Signo = Signo
    FROM dbo.TipoMovimientoInventario
    WHERE Codigo = @CodigoTipo;

    IF @IDTipo IS NULL
        THROW 50400, 'Tipo de movimiento invalido', 1;
    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50400, 'La cantidad debe ser mayor a cero', 1;
    IF @Motivo IS NULL OR LEN(LTRIM(RTRIM(@Motivo))) < 3
        THROW 50400, 'El motivo es obligatorio (3 a 300 caracteres)', 1;
    IF @CodigoTipo IN (N'SALIDA_VENTA', N'DEVOLUCION', N'CANCELACION') AND @OrigenInterno = 0
        THROW 50403, 'Tipo de movimiento reservado al sistema', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 50404, 'Variante no encontrada', 1;

    DECLARE @Existencia INT, @Reservado INT, @Nueva INT, @NuevoKardex INT, @Msg NVARCHAR(300);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Existencia = Existencia
        FROM dbo.Variante WITH (UPDLOCK, HOLDLOCK)
        WHERE IDVariante = @IDVariante;

        SELECT @Reservado = ISNULL(SUM(r.Cantidad), 0)
        FROM dbo.Reserva r
        WHERE r.IDVariante = @IDVariante
          AND r.Estado = N'Activa'
          AND r.FechaExpira > SYSUTCDATETIME();

        SET @Nueva = @Existencia + @Signo * @Cantidad;

        IF @Nueva < 0
        BEGIN
            SET @Msg = CONCAT(N'Existencia insuficiente: actual ', @Existencia, N', solicitado ', @Cantidad);
            THROW 50422, @Msg, 1;
        END

        IF (@Nueva - @Reservado) < 0
        BEGIN
            SET @Msg = CONCAT(N'No se puede retirar existencia reservada: disponible ',
                              @Existencia - @Reservado, N', solicitado ', @Cantidad);
            THROW 50422, @Msg, 1;
        END

        UPDATE dbo.Variante
           SET Existencia = @Nueva,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDVariante = @IDVariante;

        INSERT dbo.Kardex (IDVariante, IDTipoMovimientoInventario, Cantidad,
                           ExistenciaResultante, Motivo, IDUsuario, IDPedido)
        VALUES (@IDVariante, @IDTipo, @Cantidad, @Nueva, LTRIM(RTRIM(@Motivo)),
                @IDUsuarioEjecuta, @IDPedido);

        SET @NuevoKardex = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT k.IDKardex, k.IDVariante, k.IDTipoMovimientoInventario,
           t.Codigo AS CodigoTipo, t.Nombre AS NombreTipo, t.Signo,
           k.Cantidad, k.ExistenciaResultante, k.Motivo, k.IDUsuario, k.IDPedido, k.Fecha,
           @Nueva AS Existencia, @Reservado AS Reservado, (@Nueva - @Reservado) AS Disponible
    FROM dbo.Kardex k
    INNER JOIN dbo.TipoMovimientoInventario t ON t.IDTipoMovimientoInventario = k.IDTipoMovimientoInventario
    WHERE k.IDKardex = @NuevoKardex;
END
GO

/* ------------------------------------------------------------
   SP_Inventario_ListarExistencias
   Parametros: @Texto (LIKE SKU/Producto), @IDCategoria, @SoloBajoStock,
     @IncluirInactivas, @Orden (SKU|Producto|Existencia|Disponible|UltimoMovimiento),
     @Direccion (ASC|DESC), @Pagina, @TamanoPagina (1-100).
   BajoStock compara Disponible <= STOCK_MINIMO (Parametro, default 5).
   Devuelve: recordset 1 = filas de la pagina; recordset 2 = Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarExistencias
    @Texto            NVARCHAR(100) = NULL,
    @IDCategoria      INT           = NULL,
    @SoloBajoStock    BIT           = 0,
    @IncluirInactivas BIT           = 0,
    @Orden            NVARCHAR(30)  = N'SKU',
    @Direccion        NVARCHAR(4)   = N'ASC',
    @Pagina           INT           = 1,
    @TamanoPagina     INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);
    DECLARE @Patron NVARCHAR(102) = CASE WHEN @Texto IS NULL THEN NULL ELSE CONCAT(N'%', @Texto, N'%') END;
    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @Dir NVARCHAR(4) = CASE WHEN UPPER(@Direccion) = N'DESC' THEN N'DESC' ELSE N'ASC' END;

    SELECT v.IDVariante, v.SKU, v.IDProducto, p.Nombre AS Producto,
           p.IDCategoria, c.Nombre AS Categoria, v.Precio, v.Activo,
           inv.Existencia, inv.Reservado, inv.Disponible,
           ultimo.UltimoMovimiento,
           CAST(CASE WHEN inv.Disponible <= @StockMin THEN 1 ELSE 0 END AS BIT) AS BajoStock
    INTO #Existencias
    FROM dbo.Variante v
    INNER JOIN dbo.Producto p ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
    OUTER APPLY (
        SELECT MAX(k.Fecha) AS UltimoMovimiento
        FROM dbo.Kardex k
        WHERE k.IDVariante = v.IDVariante
    ) ultimo
    WHERE (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@Patron IS NULL OR v.SKU LIKE @Patron OR p.Nombre LIKE @Patron)
      AND (@SoloBajoStock = 0 OR inv.Disponible <= @StockMin)
      AND (@IncluirInactivas = 1 OR v.Activo = 1);

    SELECT IDVariante, SKU, IDProducto, Producto, IDCategoria, Categoria,
           Precio, Activo, Existencia, Reservado, Disponible, UltimoMovimiento, BajoStock
    FROM #Existencias
    ORDER BY
        CASE WHEN @Orden = N'Producto'        AND @Dir = N'ASC'  THEN Producto END ASC,
        CASE WHEN @Orden = N'Producto'        AND @Dir = N'DESC' THEN Producto END DESC,
        CASE WHEN @Orden = N'Existencia'      AND @Dir = N'ASC'  THEN Existencia END ASC,
        CASE WHEN @Orden = N'Existencia'      AND @Dir = N'DESC' THEN Existencia END DESC,
        CASE WHEN @Orden = N'Disponible'      AND @Dir = N'ASC'  THEN Disponible END ASC,
        CASE WHEN @Orden = N'Disponible'      AND @Dir = N'DESC' THEN Disponible END DESC,
        CASE WHEN @Orden = N'UltimoMovimiento' AND @Dir = N'ASC'  THEN UltimoMovimiento END ASC,
        CASE WHEN @Orden = N'UltimoMovimiento' AND @Dir = N'DESC' THEN UltimoMovimiento END DESC,
        CASE WHEN @Orden NOT IN (N'Producto', N'Existencia', N'Disponible', N'UltimoMovimiento') AND @Dir = N'ASC'  THEN SKU END ASC,
        CASE WHEN @Orden NOT IN (N'Producto', N'Existencia', N'Disponible', N'UltimoMovimiento') AND @Dir = N'DESC' THEN SKU END DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total FROM #Existencias;
END
GO

/* ------------------------------------------------------------
   SP_Inventario_ListarKardex
   Parametros: @IDVariante, @Desde, @Hasta (rango de Fecha), @Pagina, @TamanoPagina.
   Errores: 50404 si la variante no existe.
   Devuelve: recordset 1 = movimientos (Fecha DESC); recordset 2 = Total;
             recordset 3 = resumen de la variante (SKU, Producto, Existencia,
             Reservado, Disponible).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarKardex
    @IDVariante   INT,
    @Desde        DATETIME2(0) = NULL,
    @Hasta        DATETIME2(0) = NULL,
    @Pagina       INT = 1,
    @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 50404, 'Variante no encontrada', 1;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;

    SELECT k.IDKardex, k.Fecha, t.Codigo AS CodigoTipo, t.Nombre AS NombreTipo, t.Signo,
           k.Cantidad, k.ExistenciaResultante, k.Motivo,
           k.IDUsuario, u.Nombre AS Usuario, k.IDPedido, ped.NumeroPedido
    FROM dbo.Kardex k
    INNER JOIN dbo.TipoMovimientoInventario t ON t.IDTipoMovimientoInventario = k.IDTipoMovimientoInventario
    INNER JOIN dbo.Usuario u ON u.IDUsuario = k.IDUsuario
    LEFT JOIN dbo.Pedido ped ON ped.IDPedido = k.IDPedido
    WHERE k.IDVariante = @IDVariante
      AND (@Desde IS NULL OR k.Fecha >= @Desde)
      AND (@Hasta IS NULL OR k.Fecha <= @Hasta)
    ORDER BY k.Fecha DESC, k.IDKardex DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Kardex k
    WHERE k.IDVariante = @IDVariante
      AND (@Desde IS NULL OR k.Fecha >= @Desde)
      AND (@Hasta IS NULL OR k.Fecha <= @Hasta);

    SELECT v.IDVariante, v.SKU, p.Nombre AS Producto,
           inv.Existencia, inv.Reservado, inv.Disponible
    FROM dbo.Variante v
    INNER JOIN dbo.Producto p ON p.IDProducto = v.IDProducto
    INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
    WHERE v.IDVariante = @IDVariante;
END
GO

/* ------------------------------------------------------------
   SP_Inventario_VerificarConsistencia
   Audita el invariante Existencia = SUM(Signo * Cantidad) del kardex.
   Devuelve: recordset 1 = variantes inconsistentes (debe venir vacio);
             recordset 2 = TotalVariantes, VariantesInconsistentes.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_VerificarConsistencia
AS
BEGIN
    SET NOCOUNT ON;

    SELECT v.IDVariante, v.SKU, v.Existencia,
           ISNULL(s.SumaKardex, 0) AS SumaKardex,
           v.Existencia - ISNULL(s.SumaKardex, 0) AS Diferencia
    INTO #Inconsistencias
    FROM dbo.Variante v
    OUTER APPLY (
        SELECT SUM(t.Signo * k.Cantidad) AS SumaKardex
        FROM dbo.Kardex k
        INNER JOIN dbo.TipoMovimientoInventario t ON t.IDTipoMovimientoInventario = k.IDTipoMovimientoInventario
        WHERE k.IDVariante = v.IDVariante
    ) s
    WHERE v.Existencia <> ISNULL(s.SumaKardex, 0);

    SELECT IDVariante, SKU, Existencia, SumaKardex, Diferencia
    FROM #Inconsistencias
    ORDER BY IDVariante;

    SELECT (SELECT COUNT(1) FROM dbo.Variante)      AS TotalVariantes,
           (SELECT COUNT(1) FROM #Inconsistencias)  AS VariantesInconsistentes;
END
GO
