/* ============================================================
   017_Migracion_CarritoTokenUnico.sql
   ShopCart - Migracion posterior al 001: unicidad del token de invitado
   tolerante a NULL.

   Defecto corregido: dbo.Carrito nacio (en 001) con
   CONSTRAINT UQ_Carrito_TokenInvitado UNIQUE (TokenInvitado). En SQL Server un
   UNIQUE trata los NULL como valores que deben ser unicos entre si, asi que
   admite UN SOLO NULL en toda la tabla. TokenInvitado es NULL en todo carrito de
   usuario autenticado: el primer carrito de usuario convive con la restriccion,
   pero al nacer el segundo (otro NULL) la insercion falla con el error 2627
   (violacion de UNIQUE). El carrito de invitado -con token real- nunca choco; el
   defecto solo golpea a los carritos de usuario.

   Por que un indice unico filtrado y no otra cosa: la unicidad solo importa para
   tokens reales. Un indice UNIQUE con WHERE TokenInvitado IS NOT NULL exige esa
   unicidad unicamente sobre las filas con token y deja fuera a los NULL, que
   quedan sin restringir. Es la misma tecnica que ya usa UX_Carrito_UsuarioActivo
   en el 001 (unicidad parcial via indice filtrado).

   El modelo base (001) no se toca: la correccion vive en esta migracion.

   Idempotente: comprueba sys.key_constraints antes de soltar y sys.indexes antes
   de crear. GO entre el DROP y el CREATE: el lote del CREATE se compila despues
   de que la restriccion ya no exista, evitando el choque de dos objetos de
   unicidad sobre la misma columna.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* 1) Soltar la restriccion UNIQUE original (un solo NULL permitido). */
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = N'UQ_Carrito_TokenInvitado'
             AND parent_object_id = OBJECT_ID(N'dbo.Carrito'))
    ALTER TABLE dbo.Carrito DROP CONSTRAINT UQ_Carrito_TokenInvitado;
GO

/* 2) Indice unico filtrado: unicidad solo sobre tokens reales; NULL sin restringir. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'UX_Carrito_TokenInvitado'
                 AND object_id = OBJECT_ID(N'dbo.Carrito'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Carrito_TokenInvitado
        ON dbo.Carrito (TokenInvitado)
        WHERE TokenInvitado IS NOT NULL;
GO
