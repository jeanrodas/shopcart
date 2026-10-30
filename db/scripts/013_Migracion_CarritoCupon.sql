/* ============================================================
   013_Migracion_CarritoCupon.sql
   ShopCart - Migracion posterior al 001: el carrito recuerda el cupon aplicado.

   Por que una migracion aparte y no el 001: el modelo base (001) no se modifica.
   El carrito necesita recordar el cupon que el cliente aplico ANTES del checkout
   (M6), de modo que los totales (FU_Carrito_CalcularTotales) puedan descontarlo al
   mostrar el carrito. Esta migracion agrega esa columna y su llave foranea sin
   tocar datos existentes.

   M5 solo valida y guarda Carrito.IDCupon; no consume usos (eso es del checkout).

   Idempotente: comprueba COL_LENGTH y sys.foreign_keys antes de alterar.
   GO entre el ALTER de la columna y la FK: la columna debe existir (estar
   compilada) antes de que el resto del lote la referencie.

   Orden de ejecucion M5: 013 -> 014 -> 012 (se reaplica) -> 099.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* 1) Columna IDCupon en el carrito (nullable: la mayoria de carritos no tiene cupon). */
IF COL_LENGTH('dbo.Carrito', 'IDCupon') IS NULL
    ALTER TABLE dbo.Carrito ADD IDCupon INT NULL;
GO

/* 2) Llave foranea hacia Cupon. Se crea solo si la columna existe y la FK no. */
IF COL_LENGTH('dbo.Carrito', 'IDCupon') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Carrito_Cupon')
    ALTER TABLE dbo.Carrito
        ADD CONSTRAINT FK_Carrito_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon);
GO
