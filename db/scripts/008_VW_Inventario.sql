/* ============================================================
   008_VW_Inventario.sql
   ShopCart - Vista de inventario disponible, indice de busqueda y
   tipo de tabla para atributos de variante (RF-02).

   Orden de ejecucion: 008 (despues de 007_SP_Direcciones.sql).
   Idempotente: la vista usa CREATE OR ALTER; el indice y el tipo de tabla
   se crean solo si no existen (CREATE TYPE no admite OR ALTER).
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   VW_Inventario_Disponible
   Proposito: disponibilidad real por variante.
   Disponible = Existencia - reservas activas no vencidas.
   Reservado suma Reserva.Cantidad con Estado = 'Activa' y FechaExpira futura
   (0 cuando no hay reservas). El catalogo nunca escribe Existencia: nace en 0
   y solo cambia por kardex (M3).
   ------------------------------------------------------------ */
CREATE OR ALTER VIEW dbo.VW_Inventario_Disponible
AS
SELECT
    v.IDVariante,
    v.IDProducto,
    v.SKU,
    v.Activo,
    v.Existencia,
    ISNULL(r.Reservado, 0)                   AS Reservado,
    v.Existencia - ISNULL(r.Reservado, 0)    AS Disponible
FROM dbo.Variante v
OUTER APPLY (
    SELECT SUM(res.Cantidad) AS Reservado
    FROM dbo.Reserva res
    WHERE res.IDVariante = v.IDVariante
      AND res.Estado = N'Activa'
      AND res.FechaExpira > SYSUTCDATETIME()
) r;
GO

/* ------------------------------------------------------------
   IX_Producto_Nombre: apoya la busqueda por nombre del catalogo.
   ------------------------------------------------------------ */
IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_Producto_Nombre'
          AND object_id = OBJECT_ID(N'dbo.Producto'))
    CREATE NONCLUSTERED INDEX IX_Producto_Nombre
        ON dbo.Producto (Nombre)
        INCLUDE (IDCategoria, Activo);
GO

/* ------------------------------------------------------------
   TVP_VarianteAtributo: parametro de tipo tabla para pasar el conjunto de
   atributos (Nombre/Valor) de una variante en una sola llamada al SP.
   Convencion propia del proyecto: los tipos de tabla se nombran TVP_<Nombre>
   (el estandar del reto no define TVPs). CREATE TYPE no admite OR ALTER, por
   eso se comprueba sys.table_types antes de crear.
   ------------------------------------------------------------ */
IF NOT EXISTS (
        SELECT 1 FROM sys.table_types
        WHERE name = N'TVP_VarianteAtributo'
          AND schema_id = SCHEMA_ID(N'dbo'))
    CREATE TYPE dbo.TVP_VarianteAtributo AS TABLE (
        Nombre NVARCHAR(50)  NOT NULL,
        Valor  NVARCHAR(100) NOT NULL
    );
GO
