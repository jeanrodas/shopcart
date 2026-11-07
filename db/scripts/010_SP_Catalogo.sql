/* ============================================================
   010_SP_Catalogo.sql
   ShopCart - Stored procedures de productos, variantes e imagenes (RF-02).

   Reglas de negocio:
     - SKU, precio y existencia pertenecen a la VARIANTE; el producto no tiene SKU.
     - El catalogo NUNCA escribe Variante.Existencia (nace en 0, solo cambia por
       kardex en M3). Ningun SP de este archivo toca esa columna.
     - Baja logica (Activo = 0) para productos y variantes; las imagenes si se
       borran fisicamente.
     - Visible en tienda = Producto.Activo = 1 AND Categoria.Activo = 1 AND al
       menos una variante activa.

   Convenciones: ver 005_SP_Auth.sql (NOCOUNT, TRY/CATCH + TRAN en escrituras,
   THROW 50400-50499, session context con @IDUsuarioEjecuta). Sin SQL dinamico:
   filtros con (@P IS NULL OR ...), orden por lista blanca con CASE, OPTION(RECOMPILE).

   Orden de ejecucion: 010 (despues de 009_SP_Categorias.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Catalogo_BuscarProductos
   Busqueda paginada del catalogo.
   Parametros:
     @Texto           LIKE sobre Nombre del producto o SKU de alguna variante.
     @IDCategoria     filtra por categoria.
     @PrecioMin/@PrecioMax  existe variante activa con precio en el rango.
     @SoloDisponibles existe variante activa con Disponible > 0 (vista).
     @IncluirInactivos 0 = solo visibles en tienda; 1 = todo (admin/operador).
     @Orden (Nombre|Precio|FechaCreacion) + @Direccion (ASC|DESC) por lista blanca.
     @Pagina, @TamanoPagina (acotado 1-100).
   Devuelve: recordset 1 = productos de la pagina (incluye DisponibleTotal INT = suma
             del disponible de las variantes activas, y BajoStock BIT = 1 cuando
             DisponibleTotal esta entre 1 y STOCK_MINIMO); recordset 2 = Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto            NVARCHAR(100)  = NULL,
    @IDCategoria      INT            = NULL,
    @PrecioMin        DECIMAL(18,2)  = NULL,
    @PrecioMax        DECIMAL(18,2)  = NULL,
    @SoloDisponibles  BIT            = 0,
    @IncluirInactivos BIT            = 0,
    @Orden            NVARCHAR(30)   = N'Nombre',
    @Direccion        NVARCHAR(4)    = N'ASC',
    @Pagina           INT            = 1,
    @TamanoPagina     INT            = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Patron NVARCHAR(102) = CASE WHEN @Texto IS NULL THEN NULL ELSE CONCAT(N'%', @Texto, N'%') END;
    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @Dir NVARCHAR(4) = CASE WHEN UPPER(@Direccion) = N'DESC' THEN N'DESC' ELSE N'ASC' END;
    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);

    SELECT p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria,
           p.Activo, p.FechaCreacion,
           va.PrecioMinimo, va.PrecioMaximo,
           ISNULL(va.VariantesActivas, 0)                              AS VariantesActivas,
           CAST(CASE WHEN disp.HayDisponible = 1 THEN 1 ELSE 0 END AS BIT) AS HayDisponible,
           CAST(ISNULL(dt.DisponibleTotal, 0) AS INT)                  AS DisponibleTotal
    INTO #Resultado
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    OUTER APPLY (
        SELECT COUNT(1) AS VariantesActivas, MIN(v.Precio) AS PrecioMinimo, MAX(v.Precio) AS PrecioMaximo
        FROM dbo.Variante v
        WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
    ) va
    OUTER APPLY (
        SELECT CASE WHEN EXISTS (
                   SELECT 1
                   FROM dbo.Variante v
                   INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
                   WHERE v.IDProducto = p.IDProducto AND v.Activo = 1 AND inv.Disponible > 0
               ) THEN 1 ELSE 0 END AS HayDisponible
    ) disp
    OUTER APPLY (
        SELECT SUM(inv.Disponible) AS DisponibleTotal
        FROM dbo.Variante v
        INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
        WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
    ) dt
    WHERE (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@Patron IS NULL
           OR p.Nombre LIKE @Patron
           OR EXISTS (SELECT 1 FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto AND v.SKU LIKE @Patron))
      AND ((@PrecioMin IS NULL AND @PrecioMax IS NULL)
           OR EXISTS (SELECT 1 FROM dbo.Variante v
                      WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
                        AND v.Precio >= ISNULL(@PrecioMin, v.Precio)
                        AND v.Precio <= ISNULL(@PrecioMax, v.Precio)))
      AND (@SoloDisponibles = 0 OR disp.HayDisponible = 1)
      AND (@IncluirInactivos = 1
           OR (p.Activo = 1 AND c.Activo = 1 AND va.VariantesActivas > 0));

    SELECT r.IDProducto, r.Nombre, r.Descripcion, r.IDCategoria, r.Categoria,
           r.Activo, r.FechaCreacion, r.PrecioMinimo, r.PrecioMaximo,
           r.VariantesActivas, r.HayDisponible,
           r.DisponibleTotal,
           CAST(CASE WHEN r.DisponibleTotal > 0 AND r.DisponibleTotal <= @StockMin THEN 1 ELSE 0 END AS BIT) AS BajoStock,
           img.Url AS ImagenPrincipal
    FROM #Resultado r
    OUTER APPLY (
        SELECT TOP (1) pi.Url
        FROM dbo.ProductoImagen pi
        WHERE pi.IDProducto = r.IDProducto
        ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
    ) img
    ORDER BY
        CASE WHEN @Orden = N'Precio' AND @Dir = N'ASC' THEN r.PrecioMinimo END ASC,
        CASE WHEN @Orden = N'Precio' AND @Dir = N'DESC' THEN r.PrecioMinimo END DESC,
        CASE WHEN @Orden = N'FechaCreacion' AND @Dir = N'ASC' THEN r.FechaCreacion END ASC,
        CASE WHEN @Orden = N'FechaCreacion' AND @Dir = N'DESC' THEN r.FechaCreacion END DESC,
        CASE WHEN @Orden NOT IN (N'Precio', N'FechaCreacion') AND @Dir = N'ASC' THEN r.Nombre END ASC,
        CASE WHEN @Orden NOT IN (N'Precio', N'FechaCreacion') AND @Dir = N'DESC' THEN r.Nombre END DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total FROM #Resultado;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_ObtenerProducto
   Parametros: @IDProducto, @IncluirInactivos (0 = solo tienda).
   Errores: 50404 si no existe, o si esta inactivo con @IncluirInactivos = 0
            (misma respuesta en ambos casos: no revela catalogo oculto).
   Devuelve 4 recordsets:
     1) producto con su categoria;
     2) variantes (SKU, Precio, Activo, Existencia, Reservado, Disponible);
     3) atributos de esas variantes (IDVariante, Nombre, Valor);
     4) imagenes (EsPrincipal DESC, Orden).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ObtenerProducto
    @IDProducto       INT,
    @IncluirInactivos BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Activo BIT;
    SELECT @Activo = Activo FROM dbo.Producto WHERE IDProducto = @IDProducto;

    IF @Activo IS NULL OR (@Activo = 0 AND @IncluirInactivos = 0)
        THROW 50404, 'Producto no encontrado', 1;

    SELECT p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, p.Nombre, p.Descripcion,
           p.Activo, p.FechaCreacion, p.FechaActualizacion
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;

    SELECT v.IDVariante, v.SKU, v.Precio, v.Activo, v.ImagenURL,
           inv.Existencia, inv.Reservado, inv.Disponible
    FROM dbo.Variante v
    INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
    WHERE v.IDProducto = @IDProducto
      AND (@IncluirInactivos = 1 OR v.Activo = 1)
    ORDER BY v.IDVariante;

    SELECT a.IDVariante, a.Nombre, a.Valor
    FROM dbo.VarianteAtributo a
    INNER JOIN dbo.Variante v ON v.IDVariante = a.IDVariante
    WHERE v.IDProducto = @IDProducto
      AND (@IncluirInactivos = 1 OR v.Activo = 1)
    ORDER BY a.IDVariante, a.Nombre;

    SELECT IDProductoImagen, IDProducto, Url, Orden, EsPrincipal
    FROM dbo.ProductoImagen
    WHERE IDProducto = @IDProducto
    ORDER BY EsPrincipal DESC, Orden ASC, IDProductoImagen ASC;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_CrearProducto
   Parametros: @IDCategoria, @Nombre, @Descripcion, @IDUsuarioEjecuta.
   Errores: 50400 categoria inexistente o inactiva.
   Devuelve: el producto creado con su categoria.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDCategoria      INT,
    @Nombre           NVARCHAR(200),
    @Descripcion      NVARCHAR(MAX),
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND Activo = 1)
        THROW 50400, 'Categoria inexistente o inactiva', 1;

    DECLARE @NuevoID INT;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Producto (IDCategoria, Nombre, Descripcion)
        VALUES (@IDCategoria, @Nombre, @Descripcion);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, p.Nombre, p.Descripcion,
           p.Activo, p.FechaCreacion, p.FechaActualizacion
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_ActualizarProducto
   Parametros: @IDProducto, @IDCategoria, @Nombre, @Descripcion, @IDUsuarioEjecuta.
   Errores: 50404 producto no existe; 50400 categoria inexistente o inactiva.
   Efecto: FechaActualizacion = ahora. Devuelve el producto.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDProducto       INT,
    @IDCategoria      INT,
    @Nombre           NVARCHAR(200),
    @Descripcion      NVARCHAR(MAX),
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 50404, 'Producto no encontrado', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria AND Activo = 1)
        THROW 50400, 'Categoria inexistente o inactiva', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Producto
           SET IDCategoria = @IDCategoria,
               Nombre = @Nombre,
               Descripcion = @Descripcion,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDProducto = @IDProducto;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, p.Nombre, p.Descripcion,
           p.Activo, p.FechaCreacion, p.FechaActualizacion
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_CambiarEstadoProducto
   Parametros: @IDProducto, @Activo, @IDUsuarioEjecuta.
   Errores: 50404 no existe. Baja logica; no cambia el Activo de sus variantes.
   Devuelve: el producto + TieneVentas BIT (informativa: existe en PedidoDetalle).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoProducto
    @IDProducto       INT,
    @Activo           BIT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 50404, 'Producto no encontrado', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Producto
           SET Activo = @Activo,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDProducto = @IDProducto;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT p.IDProducto, p.IDCategoria, c.Nombre AS Categoria, p.Nombre, p.Descripcion,
           p.Activo, p.FechaCreacion, p.FechaActualizacion,
           CAST(CASE WHEN EXISTS (
                   SELECT 1 FROM dbo.PedidoDetalle pd
                   INNER JOIN dbo.Variante v ON v.IDVariante = pd.IDVariante
                   WHERE v.IDProducto = @IDProducto
               ) THEN 1 ELSE 0 END AS BIT) AS TieneVentas
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    WHERE p.IDProducto = @IDProducto;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_CrearVariante
   Parametros: @IDProducto, @SKU, @Precio, @Atributos (TVP READONLY),
               @IDUsuarioEjecuta.
   Errores: 50404 producto no existe; 50422 producto inactivo; 50400 precio <= 0
            o nombres de atributo duplicados; SKU duplicado -> UQ (2627 -> 409).
   Efecto: crea la variante (su Existencia queda en el DEFAULT 0) y sus atributos.
   Devuelve: 2 recordsets (la variante; sus atributos).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearVariante
    @IDProducto       INT,
    @SKU              NVARCHAR(50),
    @Precio           DECIMAL(18,2),
    @Atributos        dbo.TVP_VarianteAtributo READONLY,
    @IDUsuarioEjecuta INT,
    @ImagenURL        NVARCHAR(500) = NULL  -- F2: imagen propia de la variante (NULL = usa la del producto)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Activo BIT,
            @SkuNorm NVARCHAR(50) = UPPER(LTRIM(RTRIM(@SKU))),
            @NuevoID INT;

    SELECT @Activo = Activo FROM dbo.Producto WHERE IDProducto = @IDProducto;

    IF @Activo IS NULL
        THROW 50404, 'Producto no encontrado', 1;
    IF @Activo = 0
        THROW 50422, 'No se pueden crear variantes de un producto inactivo', 1;
    IF @Precio <= 0
        THROW 50400, 'El precio debe ser mayor a cero', 1;
    IF EXISTS (SELECT 1 FROM @Atributos GROUP BY Nombre HAVING COUNT(1) > 1)
        THROW 50400, 'Atributos con nombre duplicado', 1;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Variante (IDProducto, SKU, Precio, ImagenURL)
        VALUES (@IDProducto, @SkuNorm, @Precio, NULLIF(LTRIM(RTRIM(@ImagenURL)), N''));

        SET @NuevoID = SCOPE_IDENTITY();

        INSERT dbo.VarianteAtributo (IDVariante, Nombre, Valor)
        SELECT @NuevoID, LTRIM(RTRIM(Nombre)), LTRIM(RTRIM(Valor))
        FROM @Atributos;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDVariante, IDProducto, SKU, Precio, Existencia, Activo, ImagenURL, FechaCreacion
    FROM dbo.Variante
    WHERE IDVariante = @NuevoID;

    SELECT IDVariante, Nombre, Valor
    FROM dbo.VarianteAtributo
    WHERE IDVariante = @NuevoID
    ORDER BY Nombre;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_ActualizarVariante
   Parametros: @IDVariante, @SKU, @Precio, @Atributos (TVP READONLY),
               @IDUsuarioEjecuta.
   Errores: 50404 no existe; 50400 precio <= 0 o atributos duplicados;
            SKU duplicado -> UQ (2627 -> 409).
   Efecto: reemplaza el conjunto de atributos (DELETE + INSERT); FechaActualizacion.
           NO toca Existencia. Devuelve 2 recordsets (la variante; sus atributos).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarVariante
    @IDVariante       INT,
    @SKU              NVARCHAR(50),
    @Precio           DECIMAL(18,2),
    @Atributos        dbo.TVP_VarianteAtributo READONLY,
    @IDUsuarioEjecuta INT,
    -- F2 (aditivo): @ConservarImagen = 1 (default) NO toca ImagenURL, para que los
    -- consumidores existentes de M2 que no envian imagen no borren nada. El editor de
    -- variantes envia @ConservarImagen = 0 y, con @ImagenURL NULL, "quita" la imagen.
    @ConservarImagen  BIT           = 1,
    @ImagenURL        NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @SkuNorm NVARCHAR(50) = UPPER(LTRIM(RTRIM(@SKU)));

    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 50404, 'Variante no encontrada', 1;
    IF @Precio <= 0
        THROW 50400, 'El precio debe ser mayor a cero', 1;
    IF EXISTS (SELECT 1 FROM @Atributos GROUP BY Nombre HAVING COUNT(1) > 1)
        THROW 50400, 'Atributos con nombre duplicado', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Variante
           SET SKU = @SkuNorm,
               Precio = @Precio,
               ImagenURL = CASE WHEN @ConservarImagen = 1 THEN ImagenURL
                                ELSE NULLIF(LTRIM(RTRIM(@ImagenURL)), N'') END,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDVariante = @IDVariante;

        DELETE dbo.VarianteAtributo WHERE IDVariante = @IDVariante;

        INSERT dbo.VarianteAtributo (IDVariante, Nombre, Valor)
        SELECT @IDVariante, LTRIM(RTRIM(Nombre)), LTRIM(RTRIM(Valor))
        FROM @Atributos;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDVariante, IDProducto, SKU, Precio, Existencia, Activo, ImagenURL, FechaCreacion, FechaActualizacion
    FROM dbo.Variante
    WHERE IDVariante = @IDVariante;

    SELECT IDVariante, Nombre, Valor
    FROM dbo.VarianteAtributo
    WHERE IDVariante = @IDVariante
    ORDER BY Nombre;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_CambiarEstadoVariante
   Parametros: @IDVariante, @Activo, @IDUsuarioEjecuta.
   Errores: 50404 no existe. Baja logica. Devuelve la variante.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoVariante
    @IDVariante       INT,
    @Activo           BIT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 50404, 'Variante no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Variante
           SET Activo = @Activo,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDVariante = @IDVariante;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDVariante, IDProducto, SKU, Precio, Existencia, Activo, FechaCreacion, FechaActualizacion
    FROM dbo.Variante
    WHERE IDVariante = @IDVariante;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_AgregarImagen
   Parametros: @IDProducto, @Url, @Orden, @EsPrincipal, @IDUsuarioEjecuta.
   Errores: 50404 producto no existe.
   Reglas: si @EsPrincipal = 1 desmarca las demas del producto en la misma
           transaccion; si el producto no tiene imagenes, la nueva queda
           principal aunque venga 0.
   Devuelve: la imagen creada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_AgregarImagen
    @IDProducto       INT,
    @Url              NVARCHAR(500),
    @Orden            INT,
    @EsPrincipal      BIT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Producto WHERE IDProducto = @IDProducto)
        THROW 50404, 'Producto no encontrado', 1;

    DECLARE @HayImagenes BIT =
        CASE WHEN EXISTS (SELECT 1 FROM dbo.ProductoImagen WHERE IDProducto = @IDProducto)
             THEN 1 ELSE 0 END;
    DECLARE @Principal BIT = CASE WHEN @EsPrincipal = 1 OR @HayImagenes = 0 THEN 1 ELSE 0 END;
    DECLARE @NuevoID INT;

    BEGIN TRY
        BEGIN TRAN;

        IF @Principal = 1
            UPDATE dbo.ProductoImagen
               SET EsPrincipal = 0
             WHERE IDProducto = @IDProducto AND EsPrincipal = 1;

        INSERT dbo.ProductoImagen (IDProducto, Url, Orden, EsPrincipal)
        VALUES (@IDProducto, @Url, @Orden, @Principal);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDProductoImagen, IDProducto, Url, Orden, EsPrincipal
    FROM dbo.ProductoImagen
    WHERE IDProductoImagen = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_EliminarImagen
   Parametros: @IDProductoImagen, @IDProducto, @IDUsuarioEjecuta.
   Errores: 50404 si no existe o no pertenece al producto (la pertenencia evita
            borrar imagenes de otro producto).
   Reglas: borrado fisico; si era principal y quedan otras, la de menor Orden
           pasa a principal.
   Devuelve: FilasAfectadas.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_EliminarImagen
    @IDProductoImagen INT,
    @IDProducto       INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @EsPrincipal BIT, @Afectadas INT = 0, @Siguiente INT;

    SELECT @EsPrincipal = EsPrincipal
    FROM dbo.ProductoImagen
    WHERE IDProductoImagen = @IDProductoImagen AND IDProducto = @IDProducto;

    IF @EsPrincipal IS NULL
        THROW 50404, 'Imagen no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        DELETE dbo.ProductoImagen WHERE IDProductoImagen = @IDProductoImagen;
        SET @Afectadas = @@ROWCOUNT;

        IF @EsPrincipal = 1
        BEGIN
            SET @Siguiente = (SELECT TOP (1) IDProductoImagen
                              FROM dbo.ProductoImagen
                              WHERE IDProducto = @IDProducto
                              ORDER BY Orden ASC, IDProductoImagen ASC);
            IF @Siguiente IS NOT NULL
                UPDATE dbo.ProductoImagen SET EsPrincipal = 1 WHERE IDProductoImagen = @Siguiente;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Afectadas AS FilasAfectadas;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_MarcarImagenPrincipal
   Parametros: @IDProductoImagen, @IDProducto, @IDUsuarioEjecuta.
   Errores: 50404 si no existe o no pertenece al producto.
   Efecto: desmarca las demas y marca esta en una transaccion.
   Devuelve: la imagen marcada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_MarcarImagenPrincipal
    @IDProductoImagen INT,
    @IDProducto       INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProductoImagen
                   WHERE IDProductoImagen = @IDProductoImagen AND IDProducto = @IDProducto)
        THROW 50404, 'Imagen no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.ProductoImagen
           SET EsPrincipal = 0
         WHERE IDProducto = @IDProducto AND EsPrincipal = 1;

        UPDATE dbo.ProductoImagen
           SET EsPrincipal = 1
         WHERE IDProductoImagen = @IDProductoImagen;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDProductoImagen, IDProducto, Url, Orden, EsPrincipal
    FROM dbo.ProductoImagen
    WHERE IDProductoImagen = @IDProductoImagen;
END
GO
