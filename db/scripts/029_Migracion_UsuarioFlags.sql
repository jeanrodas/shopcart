/* ============================================================
   029_Migracion_UsuarioFlags.sql  (Fase 2, C2.1)
   Aditivo. Dos cosas sobre dbo.Usuario:
     1. Columna DebeCambiarContrasena BIT NOT NULL DEFAULT 0: se pone en 1 al crear un usuario
        interno sin contrasena (contrasena temporal) y en 0 al cambiarla en /auth/cambiar-contrasena.
     2. Trigger TR_Usuario_Bitacora: audita en dbo.Bitacora (modulo 'Usuarios') la creacion de
        usuarios internos, el cambio de rol/estado y el desbloqueo. NUNCA registra HashContrasena
        ni contrasenas. Antes dbo.Usuario no se auditaba.
   Idempotente: la columna solo se agrega si no existe; el trigger es CREATE OR ALTER.
   ============================================================ */
USE ShopCart;
GO

IF COL_LENGTH('dbo.Usuario', 'DebeCambiarContrasena') IS NULL
    ALTER TABLE dbo.Usuario ADD DebeCambiarContrasena BIT NOT NULL CONSTRAINT DF_Usuario_DebeCambiarContrasena DEFAULT 0;
GO

/* ------------------------------------------------------------
   TR_Usuario_Bitacora  (Usuarios / Usuario)
   Audita solo acciones DELIBERADAS de administracion, sin ruido de login:
     - CREAR: alta de usuario por un actor autenticado (admin crea usuario interno). La
       auto-registracion del cliente (SESSION_CONTEXT nulo) NO se audita.
     - DESACTIVAR / MODIFICAR: cambio de Activo o IDRol (rol/estado).
     - Desbloqueo (MODIFICAR): BloqueadoHasta pasa de NOT NULL a NULL por un actor autenticado
       (los reseteos de IntentosFallidos por login tienen SESSION_CONTEXT nulo y no se auditan).
   El JSON de valores EXCLUYE HashContrasena (y cualquier contrasena).
   ------------------------------------------------------------ */
CREATE OR ALTER TRIGGER dbo.TR_Usuario_Bitacora
ON dbo.Usuario
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDUsuario INT = TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT);

    /* CREAR: solo cuando lo hace un actor autenticado (admin crea usuario interno). */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'Usuarios', N'Usuario', i.IDUsuario, N'CREAR',
           NULL,
           (SELECT i.Correo, i.Nombre, i.IDRol, i.Activo, i.DebeCambiarContrasena
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    WHERE @IDUsuario IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM deleted d WHERE d.IDUsuario = i.IDUsuario);

    /* MODIFICAR / DESACTIVAR: cambio de rol, estado o desbloqueo (por actor autenticado). */
    INSERT dbo.Bitacora (Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, IDUsuario)
    SELECT N'Usuarios', N'Usuario', i.IDUsuario,
           CASE WHEN d.Activo = 1 AND i.Activo = 0 THEN N'DESACTIVAR' ELSE N'MODIFICAR' END,
           (SELECT d.Correo, d.Nombre, d.IDRol, d.Activo,
                   d.IntentosFallidos, d.BloqueadoHasta
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           (SELECT i.Correo, i.Nombre, i.IDRol, i.Activo,
                   i.IntentosFallidos, i.BloqueadoHasta
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES),
           @IDUsuario
    FROM inserted i
    INNER JOIN deleted d ON d.IDUsuario = i.IDUsuario
    WHERE @IDUsuario IS NOT NULL
      AND ( i.IDRol <> d.IDRol
            OR i.Activo <> d.Activo
            OR (d.BloqueadoHasta IS NOT NULL AND i.BloqueadoHasta IS NULL) );
END
GO
