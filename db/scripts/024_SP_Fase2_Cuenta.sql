/* ============================================================
   024_SP_Fase2_Cuenta.sql
   ShopCart - Fase 2 (aditivo): perfil del usuario, cambio de contrasena y
   listado de administracion del catalogo con estado derivado.

   Nada de lo aqui definido altera el comportamiento ni las firmas de los SPs
   evaluados en Fase 1: solo agrega objetos nuevos (y una columna nullable a
   Usuario). Convenciones: ver 005/006 (NOCOUNT; TRY/CATCH + TRAN en escrituras;
   THROW 50400-50499; sp_set_session_context @key='IDUsuario' en escrituras).
   Sin SQL dinamico. Montos DECIMAL(18,2).

   Orden de ejecucion: 024 (despues de 023). Idempotente (CREATE OR ALTER; la
   columna Telefono se agrega solo si no existe).
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   Usuario.Telefono: columna nullable para el perfil del cliente. Aditiva; las
   cuentas existentes quedan con NULL. No la tocan los SPs de Fase 1.
   ------------------------------------------------------------ */
IF COL_LENGTH('dbo.Usuario', 'Telefono') IS NULL
    ALTER TABLE dbo.Usuario ADD Telefono NVARCHAR(30) NULL;
GO

/* ------------------------------------------------------------
   SP_Usuarios_ObtenerPerfil
   Perfil del usuario autenticado para la pantalla "Mi cuenta". La tabla Usuario
   no guarda ultimo acceso, por eso no se expone.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ObtenerPerfil
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono,
           u.IDRol, r.Nombre AS Rol, u.FechaCreacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Usuarios_ActualizarPerfil
   El usuario cambia SOLO su nombre y telefono. Nunca correo ni rol. Devuelve el
   perfil actualizado (mismo shape que SP_Usuarios_ObtenerPerfil).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ActualizarPerfil
    @IDUsuario INT,
    @Nombre    NVARCHAR(150),
    @Telefono  NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    UPDATE dbo.Usuario
       SET Nombre = @Nombre,
           Telefono = @Telefono,
           FechaActualizacion = SYSUTCDATETIME()
     WHERE IDUsuario = @IDUsuario;

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono,
           u.IDRol, r.Nombre AS Rol, u.FechaCreacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Auth_ObtenerHashPorID
   Devuelve el hash actual y el estado del usuario autenticado, para que la capa
   de aplicacion compare la contrasena actual con bcrypt antes de cambiarla.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_ObtenerHashPorID
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT u.IDUsuario, u.HashContrasena, u.Activo
    FROM dbo.Usuario u
    WHERE u.IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Auth_CambiarContrasena
   Guarda el nuevo hash (ya calculado en Node) y revoca TODA la cadena de refresh
   del usuario (misma revocacion por IDUsuario que usa la rotacion de M1): tras el
   cambio, ningun refresh anterior sirve. El access vigente caduca por si solo.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_CambiarContrasena
    @IDUsuario INT,
    @HashNuevo NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE dbo.Usuario
           SET HashContrasena = @HashNuevo,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDUsuario = @IDUsuario;

        UPDATE dbo.RefreshToken
           SET FechaRevocado = SYSUTCDATETIME()
         WHERE IDUsuario = @IDUsuario AND FechaRevocado IS NULL;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_ListarAdmin
   Listado de administracion del catalogo (Administrador u Operador). Reune lo que
   la tabla de /admin/productos necesita y que SP_Catalogo_BuscarProductos (M2, no
   se toca) no provee: conteo total de variantes, SKUs (hasta 3 + total), estado
   de la categoria y el ESTADO DERIVADO calculado en SQL, mas un recordset de
   conteos por estado para subtitulo y chips.

   Estado derivado (CASE):
     oculto     = producto inactivo o su categoria inactiva
     incompleto = activo (cat activa) sin ninguna variante activa
     agotado    = activo y completo pero con DisponibleTotal = 0
     publicado  = el resto
   bajoStock es un subconjunto de publicado (DisponibleTotal entre 1 y STOCK_MINIMO).

   Parametros: @Texto, @IDCategoria, @Estado (publicado|agotado|incompleto|oculto|
   bajoStock|NULL), @Pagina, @Tamano. Paginacion OFFSET/FETCH. Sin SQL dinamico.
   Recordsets: (1) pagina, (2) Total del filtro, (3) conteos (ignoran @Estado).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarAdmin
    @Texto       NVARCHAR(100) = NULL,
    @IDCategoria INT           = NULL,
    @Estado      NVARCHAR(20)  = NULL,
    @Pagina      INT           = 1,
    @Tamano      INT           = 20
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);
    DECLARE @Patron NVARCHAR(102) = N'%' + @Texto + N'%';
    DECLARE @Offset INT = (@Pagina - 1) * @Tamano;

    /* Base filtrada por texto y categoria (NO por estado): los conteos deben
       reflejar el buscador, no el chip de estado activo. */
    SELECT
        p.IDProducto, p.Nombre, p.IDCategoria, cat.Nombre AS Categoria,
        p.Activo, cat.Activo AS CategoriaActiva,
        va.PrecioMinimo,
        ISNULL(va.VariantesActivas, 0)                 AS CantidadVariantesActivas,
        vt.CantidadVariantes,
        vt.VariantesConImagen,
        CAST(ISNULL(dt.DisponibleTotal, 0) AS INT)     AS DisponibleTotal,
        img.Url AS ImagenPrincipal,
        sk.SkusResumen, sk.SkusTotal,
        CAST(CASE WHEN p.Activo = 0 OR cat.Activo = 0 THEN 1 ELSE 0 END AS BIT) AS EsOculto
    INTO #P
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria cat ON cat.IDCategoria = p.IDCategoria
    CROSS APPLY (
        SELECT COUNT(1) AS VariantesActivas, MIN(v.Precio) AS PrecioMinimo
        FROM dbo.Variante v
        WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
    ) va
    CROSS APPLY (
        SELECT COUNT(1) AS CantidadVariantes,
               SUM(CASE WHEN v.ImagenURL IS NOT NULL THEN 1 ELSE 0 END) AS VariantesConImagen
        FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto
    ) vt
    OUTER APPLY (
        SELECT SUM(inv.Disponible) AS DisponibleTotal
        FROM dbo.Variante v
        INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
        WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
    ) dt
    OUTER APPLY (
        SELECT TOP (1) pi.Url
        FROM dbo.ProductoImagen pi
        WHERE pi.IDProducto = p.IDProducto
        ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
    ) img
    OUTER APPLY (
        SELECT
            (SELECT STRING_AGG(t.SKU, N', ') WITHIN GROUP (ORDER BY t.IDVariante)
               FROM (SELECT TOP (3) v.SKU, v.IDVariante
                       FROM dbo.Variante v
                      WHERE v.IDProducto = p.IDProducto
                      ORDER BY v.IDVariante) t) AS SkusResumen,
            (SELECT COUNT(1) FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto) AS SkusTotal
    ) sk
    WHERE (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@Texto IS NULL
           OR p.Nombre LIKE @Patron
           OR EXISTS (SELECT 1 FROM dbo.Variante v WHERE v.IDProducto = p.IDProducto AND v.SKU LIKE @Patron));

    /* Estado derivado y bajo stock, ya calculados sobre la base. */
    SELECT *,
        CAST(CASE WHEN DisponibleTotal > 0 AND DisponibleTotal <= @StockMin THEN 1 ELSE 0 END AS BIT) AS BajoStock,
        CASE
            WHEN EsOculto = 1 THEN N'oculto'
            WHEN CantidadVariantesActivas = 0 THEN N'incompleto'
            WHEN DisponibleTotal = 0 THEN N'agotado'
            ELSE N'publicado'
        END AS EstadoDerivado
    INTO #PE
    FROM #P;

    /* 1) Pagina (aplica el filtro de estado derivado). */
    SELECT
        IDProducto, Nombre, IDCategoria, Categoria, Activo, CategoriaActiva,
        PrecioMinimo, CantidadVariantes, CantidadVariantesActivas, VariantesConImagen,
        DisponibleTotal, BajoStock, ImagenPrincipal, SkusResumen, SkusTotal, EstadoDerivado
    FROM #PE
    WHERE (@Estado IS NULL
        OR (@Estado = N'bajoStock' AND EstadoDerivado = N'publicado' AND BajoStock = 1)
        OR (@Estado <> N'bajoStock' AND EstadoDerivado = @Estado))
    ORDER BY Nombre ASC, IDProducto ASC
    OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    /* 2) Total del filtro (incluye @Estado). */
    SELECT COUNT(1) AS Total
    FROM #PE
    WHERE (@Estado IS NULL
        OR (@Estado = N'bajoStock' AND EstadoDerivado = N'publicado' AND BajoStock = 1)
        OR (@Estado <> N'bajoStock' AND EstadoDerivado = @Estado));

    /* 3) Conteos por estado (ignoran @Estado) para subtitulo y chips. */
    SELECT
        COUNT(1)                                                               AS Total,
        SUM(CASE WHEN EstadoDerivado = N'publicado'  THEN 1 ELSE 0 END)        AS Publicados,
        SUM(CASE WHEN EstadoDerivado = N'agotado'    THEN 1 ELSE 0 END)        AS Agotados,
        SUM(CASE WHEN EstadoDerivado = N'incompleto' THEN 1 ELSE 0 END)        AS Incompletos,
        SUM(CASE WHEN EstadoDerivado = N'oculto'     THEN 1 ELSE 0 END)        AS Ocultos,
        SUM(CASE WHEN EstadoDerivado = N'publicado' AND BajoStock = 1 THEN 1 ELSE 0 END) AS BajoStock,
        ISNULL(SUM(CantidadVariantes), 0)                                      AS Variantes,
        ISNULL(SUM(VariantesConImagen), 0)                                     AS VariantesConImagen
    FROM #PE;

    DROP TABLE #PE;
    DROP TABLE #P;
END
GO
