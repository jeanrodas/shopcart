/* ============================================================
   009_SP_Categorias.sql
   ShopCart - Stored procedures de categorias del catalogo (RF-02).

   Convenciones: ver 005_SP_Auth.sql (NOCOUNT, TRY/CATCH + TRAN en escrituras,
   THROW 50400-50499, session context con @IDUsuarioEjecuta).
   Baja logica siempre (Activo = 0); nunca DELETE fisico de categorias.

   Orden de ejecucion: 009 (despues de 008_VW_Inventario.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Catalogo_ListarCategorias
   Parametros: @IncluirInactivas (0 = solo activas; 1 = todas, uso admin).
   Devuelve: IDCategoria, Nombre, Descripcion, Activo, FechaCreacion,
             CantidadProductosActivos. Orden por Nombre.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarCategorias
    @IncluirInactivas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Activo, c.FechaCreacion,
           (SELECT COUNT(1)
              FROM dbo.Producto p
             WHERE p.IDCategoria = c.IDCategoria AND p.Activo = 1) AS CantidadProductosActivos
    FROM dbo.Categoria c
    WHERE (@IncluirInactivas = 1 OR c.Activo = 1)
    ORDER BY c.Nombre ASC;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_CrearCategoria
   Parametros: @Nombre, @Descripcion, @IDUsuarioEjecuta.
   Errores: nombre duplicado -> UQ_Categoria_Nombre (2627 -> 409).
   Devuelve: la categoria creada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearCategoria
    @Nombre           NVARCHAR(100),
    @Descripcion      NVARCHAR(300),
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @NuevoID INT;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Categoria (Nombre, Descripcion)
        VALUES (@Nombre, @Descripcion);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDCategoria, Nombre, Descripcion, Activo, FechaCreacion
    FROM dbo.Categoria
    WHERE IDCategoria = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_ActualizarCategoria
   Parametros: @IDCategoria, @Nombre, @Descripcion, @IDUsuarioEjecuta.
   Errores: 50404 no existe; nombre duplicado -> UQ (2627 -> 409).
   Devuelve: la categoria actualizada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarCategoria
    @IDCategoria      INT,
    @Nombre           NVARCHAR(100),
    @Descripcion      NVARCHAR(300),
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 50404, 'Categoria no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Categoria
           SET Nombre = @Nombre,
               Descripcion = @Descripcion
         WHERE IDCategoria = @IDCategoria;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDCategoria, Nombre, Descripcion, Activo, FechaCreacion
    FROM dbo.Categoria
    WHERE IDCategoria = @IDCategoria;
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_CambiarEstadoCategoria
   Parametros: @IDCategoria, @Activo, @IDUsuarioEjecuta.
   Errores: 50404 no existe. Baja logica (no borra la categoria).
   Devuelve: la categoria actualizada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoCategoria
    @IDCategoria      INT,
    @Activo           BIT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE IDCategoria = @IDCategoria)
        THROW 50404, 'Categoria no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Categoria
           SET Activo = @Activo
         WHERE IDCategoria = @IDCategoria;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDCategoria, Nombre, Descripcion, Activo, FechaCreacion
    FROM dbo.Categoria
    WHERE IDCategoria = @IDCategoria;
END
GO
