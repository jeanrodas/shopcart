/* ============================================================
   003_Security.sql
   ShopCart - Seguridad: principal de aplicacion y bitacora inmutable.

   Proposito:
     - Crear el login/usuario de aplicacion 'shopcart_app' con el minimo
       privilegio: solo EXECUTE sobre el esquema dbo. Todo el acceso a datos
       pasa por stored procedures; sin permisos directos sobre tablas.
     - Blindar la bitacora (dbo.Bitacora) como append-only: DENY UPDATE/DELETE
       al usuario de aplicacion y un trigger INSTEAD OF que bloquea UPDATE/DELETE
       incluso para dbo o cualquier stored procedure.

   Orden de ejecucion: 003 (despues de 001_CreateDatabase y 002_SP_Sistema_Ping).
   Idempotente: comprueba existencia antes de crear.

   NOTA DE SEGURIDAD: 'ShopCart_Dev_2026!' es una contrasena de DESARROLLO.
   Debe cambiarse y rotarse (fuera del control de versiones) en cualquier
   ambiente real.
   ============================================================ */

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'shopcart_app')
BEGIN
    CREATE LOGIN shopcart_app
        WITH PASSWORD = N'ShopCart_Dev_2026!',
             CHECK_POLICY = ON;
END
GO

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'shopcart_app')
BEGIN
    CREATE USER shopcart_app FOR LOGIN shopcart_app;
END
GO

/* Minimo privilegio: solo ejecutar SPs del esquema dbo.
   NINGUN SELECT/INSERT/UPDATE/DELETE directo sobre tablas. */
GRANT EXECUTE ON SCHEMA::dbo TO shopcart_app;
GO

/* Bitacora inmutable para la aplicacion: ni siquiera 'shopcart_app' puede
   modificarla o borrarla. */
DENY UPDATE, DELETE ON dbo.Bitacora TO shopcart_app;
GO

/* Trigger de respaldo: bloquea UPDATE y DELETE sobre la bitacora para CUALQUIER
   principal (incluidos dbo y cualquier stored procedure). La unica operacion
   permitida sobre dbo.Bitacora es INSERT. */
CREATE OR ALTER TRIGGER dbo.TR_Bitacora_Inmutable
ON dbo.Bitacora
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50403, 'La bitacora es inmutable', 1;
END
GO
