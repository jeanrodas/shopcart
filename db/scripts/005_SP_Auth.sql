/* ============================================================
   005_SP_Auth.sql
   ShopCart - Stored procedures de autenticacion (RF-01).

   Convenciones:
     - SET NOCOUNT ON en todos.
     - Escrituras con multiples sentencias en BEGIN TRAN / COMMIT con
       BEGIN TRY / BEGIN CATCH que hace ROLLBACK si @@TRANCOUNT > 0 y relanza
       con THROW (sin numero, para conservar el error original).
     - Errores de negocio: THROW 50400-50499 (status HTTP = numero - 50000),
       mensajes en espanol sin acentos.
     - Auditoria: los SP que escriben publican el actor en el contexto de sesion
       con sys.sp_set_session_context (@key = N'IDUsuario').

   Orden de ejecucion: 005 (despues de 004_Catalogos.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Auth_RegistrarCliente
   Proposito: alta de un cliente autoservicio.
   Parametros: @Correo, @HashContrasena, @Nombre.
   Errores: 50409 correo ya registrado; 50422 rol Cliente no configurado.
   Devuelve: IDUsuario, Correo, Nombre, IDRol, Rol.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RegistrarCliente
    @Correo          NVARCHAR(255),
    @HashContrasena  NVARCHAR(255),
    @Nombre          NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CorreoNorm NVARCHAR(255) = LOWER(LTRIM(RTRIM(@Correo)));
    DECLARE @IDRol INT = (SELECT IDRol FROM dbo.Rol WHERE Nombre = N'Cliente');
    DECLARE @NuevoID INT;

    IF @IDRol IS NULL
        THROW 50422, 'Configuracion incompleta: falta el rol Cliente', 1;

    IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = @CorreoNorm)
        THROW 50409, 'El correo ya esta registrado', 1;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
        VALUES (@IDRol, @CorreoNorm, @HashContrasena, @Nombre);

        SET @NuevoID = SCOPE_IDENTITY();

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @NuevoID;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.IDRol, r.Nombre AS Rol
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Auth_ObtenerUsuarioPorCorreo
   Proposito: cargar credenciales para el login. Solo lectura.
   No lanza error si no existe (el servicio no revela existencia).
   Devuelve (0 o 1 fila): IDUsuario, Correo, HashContrasena, Nombre, Activo,
            IDRol, Rol, IntentosFallidos, BloqueadoHasta.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_ObtenerUsuarioPorCorreo
    @Correo NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CorreoNorm NVARCHAR(255) = LOWER(LTRIM(RTRIM(@Correo)));

    SELECT u.IDUsuario, u.Correo, u.HashContrasena, u.Nombre, u.Activo,
           u.IDRol, r.Nombre AS Rol, u.IntentosFallidos, u.BloqueadoHasta
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.Correo = @CorreoNorm;
END
GO

/* ------------------------------------------------------------
   SP_Auth_RegistrarIntentoFallido
   Proposito: contar un intento de login fallido y bloquear la cuenta al
              alcanzar LOGIN_MAX_INTENTOS (reinicia el contador al bloquear).
   Parametros: @IDUsuario.
   Devuelve: IntentosFallidos, BloqueadoHasta (estado posterior).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RegistrarIntentoFallido
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @Max INT  = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'LOGIN_MAX_INTENTOS') AS INT), 5);
    DECLARE @Bloq INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'LOGIN_BLOQUEO_MINUTOS') AS INT), 15);

    BEGIN TRY
        BEGIN TRAN;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        UPDATE dbo.Usuario
           SET BloqueadoHasta   = CASE WHEN IntentosFallidos + 1 >= @Max
                                       THEN DATEADD(MINUTE, @Bloq, @Ahora)
                                       ELSE BloqueadoHasta END,
               IntentosFallidos = CASE WHEN IntentosFallidos + 1 >= @Max
                                       THEN 0
                                       ELSE IntentosFallidos + 1 END
         WHERE IDUsuario = @IDUsuario;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IntentosFallidos, BloqueadoHasta
    FROM dbo.Usuario
    WHERE IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Auth_RegistrarLoginExitoso
   Proposito: limpiar contador y bloqueo tras un login correcto.
   Parametros: @IDUsuario.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RegistrarLoginExitoso
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRAN;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        UPDATE dbo.Usuario
           SET IntentosFallidos = 0,
               BloqueadoHasta   = NULL
         WHERE IDUsuario = @IDUsuario;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO

/* ------------------------------------------------------------
   SP_Auth_GuardarRefreshToken
   Proposito: persistir el hash SHA-256 de un refresh token emitido.
   Parametros: @IDUsuario, @TokenHash, @FechaExpira, @DireccionIP.
   Devuelve: IDRefreshToken.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_GuardarRefreshToken
    @IDUsuario    INT,
    @TokenHash    CHAR(64),
    @FechaExpira  DATETIME2(0),
    @DireccionIP  NVARCHAR(45)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @NuevoID INT;

    BEGIN TRY
        BEGIN TRAN;

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        INSERT dbo.RefreshToken (IDUsuario, TokenHash, FechaExpira, DireccionIP)
        VALUES (@IDUsuario, @TokenHash, @FechaExpira, @DireccionIP);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @NuevoID AS IDRefreshToken;
END
GO

/* ------------------------------------------------------------
   SP_Auth_RotarRefreshToken
   Proposito: rotacion de refresh token con deteccion de reutilizacion.
   Parametros: @TokenHash, @NuevoTokenHash, @FechaExpiraNuevo, @DireccionIP.
   Errores (todos 50401):
     - 'Refresh token invalido'               (no existe)
     - 'Refresh token reutilizado; sesiones revocadas' (ya rotado: revoca cadena)
     - 'Refresh token expirado'               (vencido: lo marca revocado)
     - 'Usuario desactivado'
   Devuelve (exito): IDRefreshToken (nuevo), IDUsuario, Correo, Nombre, IDRol, Rol.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RotarRefreshToken
    @TokenHash         CHAR(64),
    @NuevoTokenHash    CHAR(64),
    @FechaExpiraNuevo  DATETIME2(0),
    @DireccionIP       NVARCHAR(45)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @IDRefreshToken INT, @IDUsuario INT,
            @FechaRevocado DATETIME2(0), @FechaExpira DATETIME2(0),
            @Activo BIT, @NuevoID INT;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @IDRefreshToken = rt.IDRefreshToken,
               @IDUsuario      = rt.IDUsuario,
               @FechaRevocado  = rt.FechaRevocado,
               @FechaExpira    = rt.FechaExpira,
               @Activo         = u.Activo
        FROM dbo.RefreshToken rt WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN dbo.Usuario u ON u.IDUsuario = rt.IDUsuario
        WHERE rt.TokenHash = @TokenHash;

        IF @IDRefreshToken IS NULL
        BEGIN
            COMMIT;
            THROW 50401, 'Refresh token invalido', 1;
        END

        EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;

        IF @FechaRevocado IS NOT NULL
        BEGIN
            UPDATE dbo.RefreshToken
               SET FechaRevocado = @Ahora
             WHERE IDUsuario = @IDUsuario AND FechaRevocado IS NULL;
            COMMIT;
            THROW 50401, 'Refresh token reutilizado; sesiones revocadas', 1;
        END

        IF @FechaExpira <= @Ahora
        BEGIN
            UPDATE dbo.RefreshToken
               SET FechaRevocado = @Ahora
             WHERE IDRefreshToken = @IDRefreshToken AND FechaRevocado IS NULL;
            COMMIT;
            THROW 50401, 'Refresh token expirado', 1;
        END

        IF @Activo = 0
        BEGIN
            COMMIT;
            THROW 50401, 'Usuario desactivado', 1;
        END

        INSERT dbo.RefreshToken (IDUsuario, TokenHash, FechaExpira, DireccionIP)
        VALUES (@IDUsuario, @NuevoTokenHash, @FechaExpiraNuevo, @DireccionIP);

        SET @NuevoID = SCOPE_IDENTITY();

        UPDATE dbo.RefreshToken
           SET FechaRevocado = @Ahora, IDTokenReemplazo = @NuevoID
         WHERE IDRefreshToken = @IDRefreshToken;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @NuevoID AS IDRefreshToken,
           u.IDUsuario, u.Correo, u.Nombre, u.IDRol, r.Nombre AS Rol
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO

/* ------------------------------------------------------------
   SP_Auth_RevocarRefreshToken
   Proposito: logout idempotente. Marca revocado si el token esta activo;
              si no existe no lanza error.
   Parametros: @TokenHash.
   Devuelve: FilasAfectadas.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RevocarRefreshToken
    @TokenHash CHAR(64)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Afectadas INT = 0;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.RefreshToken
           SET FechaRevocado = SYSUTCDATETIME()
         WHERE TokenHash = @TokenHash AND FechaRevocado IS NULL;

        SET @Afectadas = @@ROWCOUNT;

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
   SP_Auth_ObtenerUsuarioPorID
   Proposito: perfil del usuario autenticado (GET /auth/yo). Solo lectura.
   Parametros: @IDUsuario.
   Errores: 50404 usuario no encontrado.
   Devuelve: IDUsuario, Correo, Nombre, Activo, IDRol, Rol, FechaCreacion.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Auth_ObtenerUsuarioPorID
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Activo, u.IDRol, r.Nombre AS Rol, u.FechaCreacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO
