/* ============================================================
   025_Migracion_VarianteImagen.sql
   ShopCart - Fase 2 (aditivo): imagen propia por variante.

   Agrega la columna nullable dbo.Variante.ImagenURL. Una variante puede tener UNA
   imagen propia; cuando es NULL, la tienda/carrito/pedidos usan la imagen principal
   del producto (COALESCE en los SPs que exponen la imagen de la linea).

   Debe ejecutarse ANTES de los SPs que referencian la columna (010, 012, 016/018,
   023, 024): SQL Server valida las columnas de una tabla existente al compilar el SP
   (no hay resolucion diferida de columnas). Por eso en el orden del instalador este
   script va reordenado antes de 010, igual que 022 va antes de 016/018.

   Idempotente: la columna se agrega solo si no existe (COL_LENGTH).
   ============================================================ */

USE ShopCart;
GO

IF COL_LENGTH('dbo.Variante', 'ImagenURL') IS NULL
    ALTER TABLE dbo.Variante ADD ImagenURL NVARCHAR(500) NULL;
GO
