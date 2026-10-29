/* ============================================================
   099_Semillas.sql
   ShopCart - Datos de ejemplo para desarrollo/pruebas (idempotente).

   Este archivo crece con cada modulo; mantener las secciones separadas por
   modulo. Idempotente: comprueba existencia por clave natural antes de insertar.

   Orden de ejecucion: ultimo (despues de 004-007 y de los scripts de cada modulo).

   NOTA DE SEGURIDAD: los hashes son de contrasenas de DESARROLLO conocidas
   (ver README "Credenciales de prueba"). No usar en ambientes reales.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   M1 - Autenticacion, usuarios y direcciones (RF-01)
   ============================================================ */

/* Usuarios de prueba (bcryptjs, cost 10):
   admin@shopcart.local    / Admin123!     (Administrador)
   operador@shopcart.local / Operador123!  (Operador)
   cliente@shopcart.local  / Cliente123!   (Cliente) */

IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = N'admin@shopcart.local')
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, N'admin@shopcart.local',
           N'$2b$10$.8iwa1p0mhFSaV8/z1gViuTxWoikONwiOSuMYoQV4ufbSCIqWWU7y',
           N'Administrador ShopCart'
    FROM dbo.Rol r WHERE r.Nombre = N'Administrador';

IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = N'operador@shopcart.local')
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, N'operador@shopcart.local',
           N'$2b$10$Kp9.7u9VSTHhtIVFPObs8ukGEDecSkzf7VvahFTu0HquycDvgFyqW',
           N'Operador ShopCart'
    FROM dbo.Rol r WHERE r.Nombre = N'Operador';

IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = N'cliente@shopcart.local')
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, N'cliente@shopcart.local',
           N'$2b$10$ESr6NozUG8lCqPJtgzbLBeVVgGe64DVT.61MZeVUJTlDUR3/SBrSK',
           N'Cliente ShopCart'
    FROM dbo.Rol r WHERE r.Nombre = N'Cliente';
GO

/* Direccion activa del cliente de prueba */
IF NOT EXISTS (
        SELECT 1
        FROM dbo.Direccion d
        INNER JOIN dbo.Usuario u ON u.IDUsuario = d.IDUsuario
        WHERE u.Correo = N'cliente@shopcart.local' AND d.Alias = N'Casa')
    INSERT dbo.Direccion (IDUsuario, Alias, NombreReceptor, Telefono,
                          Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia)
    SELECT u.IDUsuario, N'Casa', N'Cliente ShopCart', N'+502 5555-0000',
           N'1a Calle 2-34 Zona 1', NULL, N'Guatemala', N'Guatemala', N'01001',
           N'Casa de dos niveles, porton negro'
    FROM dbo.Usuario u
    WHERE u.Correo = N'cliente@shopcart.local';
GO

/* ============================================================
   M2 - Catalogo (pendiente)
   ============================================================ */
-- Las semillas de catalogo (categorias, productos, variantes) se agregaran
-- cuando se implemente el modulo correspondiente.
