/* ============================================================
   002_SP_Sistema_Ping.sql
   ShopCart - Procedimiento de verificacion de disponibilidad.
   Idempotente (CREATE OR ALTER). Ejecutar sobre la BD ShopCart.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.SP_Sistema_Ping
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 1 AS Ok;
END
GO
