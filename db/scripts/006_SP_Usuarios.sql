/* ============================================================
   006_SP_Usuarios.sql
   ShopCart - Stored procedures de gestion de usuarios (Administrador, RF-01).

   Convenciones: ver 005_SP_Auth.sql (NOCOUNT, TRY/CATCH + TRAN en escrituras,
   THROW 50400-50499, session context con @IDUsuarioEjecuta).

   Orden de ejecucion: 006 (despues de 005_SP_Auth.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Usuarios_Listar
   Proposito: listado paginado y filtrable de usuarios (sin HashContrasena).
   Parametros: @Pagina, @TamanoPagina (acotado 1-100), @Texto (LIKE Nombre/Correo),
               @IDRol, @Activo, @Orden (Nombre|Correo|FechaCreacion), @Direccion (ASC|DESC).
   Devuelve: recordset 1 = filas de la pagina; recordset 2 = Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @Pagina       INT,
    @TamanoPagina INT,
    @Texto        NVARCHAR(100) = NULL,
    @IDRol        INT = NULL,
    @Activo       BIT = NULL,
    @Orden        NVARCHAR(30) = N'Nombre',
    @Direccion    NVARCHAR(4)  = N'ASC'
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

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Activo, u.IDRol, r.Nombre AS Rol,
           u.IntentosFallidos, u.BloqueadoHasta, u.FechaCreacion, u.FechaActualizacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE (@IDRol IS NULL OR u.IDRol = @IDRol)
      AND (@Activo IS NULL OR u.Activo = @Activo)
      AND (@Patron IS NULL OR u.Nombre LIKE @Patron OR u.Correo LIKE @Patron)
    ORDER BY
        CASE WHEN @Orden = N'Correo' AND @Dir = N'ASC' THEN u.Correo END ASC,
        CASE WHEN @Orden = N'Correo' AND @Dir = N'DESC' THEN u.Correo END DESC,
        CASE WHEN @Orden = N'FechaCreacion' AND @Dir = N'ASC' THEN u.FechaCreacion END ASC,
        CASE WHEN @Orden = N'FechaCreacion' AND @Dir = N'DESC' THEN u.FechaCreacion END DESC,
        CASE WHEN @Orden NOT IN (N'Correo', N'FechaCreacion') AND @Dir = N'ASC' THEN u.Nombre END ASC,
        CASE WHEN @Orden NOT IN (N'Correo', N'FechaCreacion') AND @Dir = N'DESC' THEN u.Nombre END DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Usuario u
    WHERE (@IDRol IS NULL OR u.IDRol = @IDRol)
      AND (@Activo IS NULL OR u.Activo = @Activo)
      AND (@Patron IS NULL OR u.Nombre LIKE @Patron OR u.Correo LIKE @Patron);
END
GO

/* ------------------------------------------------------------
   SP_Usuarios_Crear
   Proposito: el Administrador crea Operadores/Administradores (o Clientes).
   Parametros: @Correo, @HashContrasena, @Nombre, @IDRol, @IDUsuarioEjecuta.
   Errores: 50409 correo duplicado; 50400 rol inexistente.
   Devuelve: IDUsuario, Correo, Nombre, Activo, IDRol, Rol, FechaCreacion.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Crear
    @Correo          NVARCHAR(255),
    @HashContrasena  NVARCHAR(255),
    @Nombre          NVARCHAR(150),
    @IDRol           INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @CorreoNorm NVARCHAR(255) = LOWER(LTRIM(RTRIM(@Correo)));
    DECLARE @NuevoID INT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE IDRol = @IDRol)
        THROW 50400, 'El rol indicado no existe', 1;

    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = @CorreoNorm)
        THROW 50409, 'El correo ya esta registrado', 1;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
        VALUES (@IDRol, @CorreoNorm, @HashContrasena, @Nombre);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Activo, u.IDRol, r.Nombre AS Rol, u.FechaCreacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Usuarios_CambiarRol
   Parametros: @IDUsuario, @IDRol, @IDUsuarioEjecuta.
   Errores: 50404 usuario no existe; 50400 rol inexistente;
            50409 no puede cambiar su propio rol.
   Devuelve: el usuario actualizado.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarRol
    @IDUsuario        INT,
    @IDRol            INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF @IDUsuario = @IDUsuarioEjecuta
        THROW 50409, 'No puede cambiar su propio rol', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Rol WHERE IDRol = @IDRol)
        THROW 50400, 'El rol indicado no existe', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Usuario
           SET IDRol = @IDRol,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDUsuario = @IDUsuario;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Activo, u.IDRol, r.Nombre AS Rol,
           u.FechaCreacion, u.FechaActualizacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Usuarios_CambiarEstado
   Parametros: @IDUsuario, @Activo, @IDUsuarioEjecuta.
   Errores: 50404 usuario no existe; 50409 no puede desactivar su propia cuenta.
   Efecto: al desactivar, revoca todos los refresh tokens activos del usuario.
   Devuelve: el usuario actualizado.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_CambiarEstado
    @IDUsuario        INT,
    @Activo           BIT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;

    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF @Activo = 0 AND @IDUsuario = @IDUsuarioEjecuta
        THROW 50409, 'No puede desactivar su propia cuenta', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Usuario
           SET Activo = @Activo,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDUsuario = @IDUsuario;

        IF @Activo = 0
            UPDATE dbo.RefreshToken
               SET FechaRevocado = SYSUTCDATETIME()
             WHERE IDUsuario = @IDUsuario AND FechaRevocado IS NULL;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Activo, u.IDRol, r.Nombre AS Rol,
           u.FechaCreacion, u.FechaActualizacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO
