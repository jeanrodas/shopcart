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

   Solucion: un indice unico filtrado (WHERE TokenInvitado IS NOT NULL) exige la
   unicidad SOLO sobre los tokens reales y deja los NULL sin restringir. Es la
   misma tecnica que UX_Carrito_UsuarioActivo en el 001 (unicidad parcial).

   Por que crear el indice ANTES de soltar la restriccion, y en una sola
   transaccion: el indice filtrado y la restriccion son objetos independientes con
   nombres distintos, de modo que coexisten sin conflicto (ambos rechazan
   duplicados de tokens reales por igual). Creando primero el indice y soltando
   despues la restriccion, dentro de una unica transaccion con XACT_ABORT ON, NUNCA
   existe un instante en el que la columna quede sin garantia de unicidad.

   El modelo base (001) no se toca: la correccion vive en esta migracion.

   Idempotente: crea el indice solo si no existe y suelta la restriccion solo si
   existe. En una BD donde ya se aplico una version anterior de esta migracion
   (indice presente, restriccion ya eliminada) ambos pasos se omiten y la
   transaccion confirma sin cambios y sin error.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

SET XACT_ABORT ON;
BEGIN TRAN;

    /* 1) Indice unico filtrado: unicidad solo sobre tokens reales; NULL sin
          restringir. Se crea PRIMERO para que la unicidad nunca falte. */
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = N'UX_Carrito_TokenInvitado'
                     AND object_id = OBJECT_ID(N'dbo.Carrito'))
        CREATE UNIQUE NONCLUSTERED INDEX UX_Carrito_TokenInvitado
            ON dbo.Carrito (TokenInvitado)
            WHERE TokenInvitado IS NOT NULL;

    /* 2) Suelta la restriccion UNIQUE original (admitia un solo NULL). */
    IF EXISTS (SELECT 1 FROM sys.key_constraints
               WHERE name = N'UQ_Carrito_TokenInvitado'
                 AND parent_object_id = OBJECT_ID(N'dbo.Carrito'))
        ALTER TABLE dbo.Carrito DROP CONSTRAINT UQ_Carrito_TokenInvitado;

COMMIT;
GO
