/* ============================================================
   007_SP_Direcciones.sql
   ShopCart - Stored procedures de direcciones del usuario (RF-01).

   La pertenencia (ownership) SIEMPRE se valida aqui con @IDUsuario (tomado del
   token por el backend). El :id de la URL es solo @IDDireccion.

   Convenciones: ver 005_SP_Auth.sql.

   Orden de ejecucion: 007 (despues de 006_SP_Usuarios.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Direcciones_Listar
   Parametros: @IDUsuario. Devuelve: direcciones ACTIVAS del usuario.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Listar
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT IDDireccion, IDUsuario, Alias, NombreReceptor, Telefono,
           Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia,
           Activo, FechaCreacion
    FROM dbo.Direccion
    WHERE IDUsuario = @IDUsuario AND Activo = 1
    ORDER BY Alias ASC;
END
GO

/* ------------------------------------------------------------
   SP_Direcciones_Obtener
   Parametros: @IDDireccion, @IDUsuario.
   Errores: 50404 no existe, inactiva o ajena (respuesta uniforme, no revela existencia).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Obtener
    @IDDireccion INT,
    @IDUsuario   INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Owner INT, @Activo BIT;
    SELECT @Owner = IDUsuario, @Activo = Activo
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;

    IF @Owner IS NULL
        THROW 50404, 'Direccion no encontrada', 1;
    IF @Owner <> @IDUsuario
        THROW 50404, 'Direccion no encontrada', 1;
    IF @Activo = 0
        THROW 50404, 'Direccion no encontrada', 1;

    SELECT IDDireccion, IDUsuario, Alias, NombreReceptor, Telefono,
           Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia,
           Activo, FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;
END
GO

/* ------------------------------------------------------------
   SP_Direcciones_Crear
   Parametros: @IDUsuario (dueno), datos de la direccion, @IDUsuarioEjecuta.
   Devuelve: la direccion creada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Crear
    @IDUsuario        INT,
    @Alias            NVARCHAR(50),
    @NombreReceptor   NVARCHAR(150),
    @Telefono         NVARCHAR(20),
    @Linea1           NVARCHAR(200),
    @Linea2           NVARCHAR(200),
    @Municipio        NVARCHAR(100),
    @Departamento     NVARCHAR(100),
    @CodigoPostal     NVARCHAR(10),
    @Referencia       NVARCHAR(300),
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @NuevoID INT;

    BEGIN TRY
        BEGIN TRAN;

        INSERT dbo.Direccion (IDUsuario, Alias, NombreReceptor, Telefono,
                              Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia)
        VALUES (@IDUsuario, @Alias, @NombreReceptor, @Telefono,
                @Linea1, @Linea2, @Municipio, @Departamento, @CodigoPostal, @Referencia);

        SET @NuevoID = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDDireccion, IDUsuario, Alias, NombreReceptor, Telefono,
           Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia,
           Activo, FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @NuevoID;
END
GO

/* ------------------------------------------------------------
   SP_Direcciones_Actualizar
   Parametros: @IDDireccion, @IDUsuario, datos, @IDUsuarioEjecuta.
   Errores: 50404 no existe, inactiva o ajena (respuesta uniforme, no revela existencia).
   Devuelve: la direccion actualizada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDDireccion      INT,
    @IDUsuario        INT,
    @Alias            NVARCHAR(50),
    @NombreReceptor   NVARCHAR(150),
    @Telefono         NVARCHAR(20),
    @Linea1           NVARCHAR(200),
    @Linea2           NVARCHAR(200),
    @Municipio        NVARCHAR(100),
    @Departamento     NVARCHAR(100),
    @CodigoPostal     NVARCHAR(10),
    @Referencia       NVARCHAR(300),
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Owner INT, @Activo BIT;
    SELECT @Owner = IDUsuario, @Activo = Activo
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;

    IF @Owner IS NULL
        THROW 50404, 'Direccion no encontrada', 1;
    IF @Owner <> @IDUsuario
        THROW 50404, 'Direccion no encontrada', 1;
    IF @Activo = 0
        THROW 50404, 'Direccion no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Direccion
           SET Alias          = @Alias,
               NombreReceptor = @NombreReceptor,
               Telefono       = @Telefono,
               Linea1         = @Linea1,
               Linea2         = @Linea2,
               Municipio      = @Municipio,
               Departamento   = @Departamento,
               CodigoPostal   = @CodigoPostal,
               Referencia     = @Referencia
         WHERE IDDireccion = @IDDireccion;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT IDDireccion, IDUsuario, Alias, NombreReceptor, Telefono,
           Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia,
           Activo, FechaCreacion
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;
END
GO

/* ------------------------------------------------------------
   SP_Direcciones_Desactivar
   Parametros: @IDDireccion, @IDUsuario, @IDUsuarioEjecuta.
   Baja logica (Activo = 0); nunca borrado fisico (Pedido referencia IDDireccion).
   Errores: 50404 no existe, inactiva o ajena (respuesta uniforme, no revela existencia).
   Devuelve: FilasAfectadas.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Desactivar
    @IDDireccion      INT,
    @IDUsuario        INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    DECLARE @Owner INT, @Activo BIT, @Afectadas INT = 0;
    SELECT @Owner = IDUsuario, @Activo = Activo
    FROM dbo.Direccion
    WHERE IDDireccion = @IDDireccion;

    IF @Owner IS NULL
        THROW 50404, 'Direccion no encontrada', 1;
    IF @Owner <> @IDUsuario
        THROW 50404, 'Direccion no encontrada', 1;
    IF @Activo = 0
        THROW 50404, 'Direccion no encontrada', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Direccion
           SET Activo = 0
         WHERE IDDireccion = @IDDireccion;

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
