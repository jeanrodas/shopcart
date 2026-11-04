/* ============================================================
   021_SP_Catalogo_Publico.sql
   ShopCart - Stored procedures publicos para la tienda (Fase 2 frontend):
   cupones vigentes y productos destacados (mas vendidos y ofertas).

   Reglas de negocio:
     - "Vigente" (cupon) = Activo = 1 AND FechaInicio <= ahora < FechaFin AND
       (LimiteUsosTotal IS NULL OR UsosActuales < LimiteUsosTotal). SP_Cupones_Vigentes
       NUNCA expone limites de uso, usos actuales ni limite por cliente.
     - "Visible en tienda" = Producto.Activo = 1 AND Categoria.Activo = 1 AND al menos
       una variante activa (misma regla que SP_Catalogo_BuscarProductos).
     - "Mas vendidos" = unidades netas (VW_Reportes_LineaNeta) de los ultimos 30 dias;
       si no hay ventas en el rango, se ordena por FechaCreacion DESC.
     - "Ofertas" = productos cuya categoria tiene un cupon de categoria vigente de tipo
       PORCENTAJE. Los cupones de MONTO se excluyen: aplican una vez por carrito y pueden
       exigir monto minimo, asi que un "precio con cupon" por unidad seria falso.
       PrecioConCupon = ROUND(PrecioMinimo * (1 - Valor/100), 2). Si un producto califica
       por mas de un cupon PORCENTAJE, gana el de mayor Valor.

   Convenciones: ver 010/020 (NOCOUNT; sin SQL dinamico; mensajes sin acentos; filtros
   con (@P IS NULL OR ...); OPTION (RECOMPILE)). Solo lectura: sin TRAN ni XACT_ABORT.
   Montos DECIMAL(18,2). Requiere las columnas DisponibleTotal/BajoStock que agrega 010.

   Orden de ejecucion: 021 (despues de 020_Reportes.sql, antes de 099_Semillas.sql).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Cupones_Vigentes
   Sin parametros. Lista los cupones aplicables ahora mismo para mostrarlos en la
   tienda. Orden: generales (sin categoria) primero, luego por FechaFin ascendente.
   NO devuelve LimiteUsosTotal, UsosActuales ni LimiteUsosPorCliente.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Vigentes
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();

    SELECT
        c.IDCupon,
        c.Codigo,
        c.TipoDescuento,
        c.Valor,
        c.IDCategoria,
        cat.Nombre          AS Categoria,   -- NULL cuando el cupon es general
        c.MontoMinimo,
        c.FechaFin
    FROM dbo.Cupon c
    LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
    WHERE c.Activo = 1
      AND c.FechaInicio <= @Ahora
      AND c.FechaFin > @Ahora
      AND (c.LimiteUsosTotal IS NULL OR c.UsosActuales < c.LimiteUsosTotal)
    ORDER BY
        CASE WHEN c.IDCategoria IS NULL THEN 0 ELSE 1 END,
        c.FechaFin ASC,
        c.IDCupon ASC
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Catalogo_Destacados
   Parametros: @Limite INT (acotado 1-24, default 8).
   Devuelve 2 recordsets:
     1) MasVendidos: productos visibles ordenados por unidades netas de 30 dias
        (o FechaCreacion DESC si no hubo ventas). Columnas de SP_Catalogo_BuscarProductos
        + UnidadesVendidas INT + Posicion INT (1..N).
     2) Ofertas: productos visibles con cupon de categoria vigente PORCENTAJE. Columnas de
        SP_Catalogo_BuscarProductos + CuponCodigo, TipoDescuento (siempre PORCENTAJE),
        Valor, MontoMinimo, PrecioConCupon.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_Destacados
    @Limite INT = 8
AS
BEGIN
    SET NOCOUNT ON;

    IF @Limite IS NULL OR @Limite < 1 SET @Limite = 8;
    IF @Limite > 24 SET @Limite = 24;

    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);
    DECLARE @Desde DATETIME2(0) = DATEADD(DAY, -30, SYSUTCDATETIME());
    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();

    /* Base: productos visibles en tienda con las mismas columnas que BuscarProductos. */
    SELECT
        p.IDProducto, p.Nombre, p.Descripcion, p.IDCategoria, c.Nombre AS Categoria,
        p.Activo, p.FechaCreacion,
        va.PrecioMinimo, va.PrecioMaximo,
        va.VariantesActivas,
        CAST(CASE WHEN dt.DisponibleTotal > 0 THEN 1 ELSE 0 END AS BIT)                        AS HayDisponible,
        CAST(ISNULL(dt.DisponibleTotal, 0) AS INT)                                             AS DisponibleTotal,
        CAST(CASE WHEN ISNULL(dt.DisponibleTotal, 0) > 0
                   AND ISNULL(dt.DisponibleTotal, 0) <= @StockMin THEN 1 ELSE 0 END AS BIT)    AS BajoStock,
        img.Url AS ImagenPrincipal
    INTO #Visibles
    FROM dbo.Producto p
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    CROSS APPLY (
        SELECT COUNT(1) AS VariantesActivas, MIN(v.Precio) AS PrecioMinimo, MAX(v.Precio) AS PrecioMaximo
        FROM dbo.Variante v
        WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
    ) va
    CROSS APPLY (
        SELECT SUM(inv.Disponible) AS DisponibleTotal
        FROM dbo.Variante v
        INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
        WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
    ) dt
    OUTER APPLY (
        SELECT TOP (1) pi.Url
        FROM dbo.ProductoImagen pi
        WHERE pi.IDProducto = p.IDProducto
        ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
    ) img
    WHERE p.Activo = 1 AND c.Activo = 1 AND va.VariantesActivas > 0;

    /* Unidades netas por producto en los ultimos 30 dias. */
    SELECT ln.IDProducto, SUM(ln.CantidadNeta) AS Unidades
    INTO #Ventas
    FROM dbo.VW_Reportes_LineaNeta ln
    WHERE ln.Fecha >= @Desde
    GROUP BY ln.IDProducto;

    DECLARE @HayVentas BIT =
        CASE WHEN EXISTS (SELECT 1 FROM #Ventas WHERE Unidades > 0) THEN 1 ELSE 0 END;

    /* Recordset 1: MasVendidos. */
    ;WITH Rankeados AS (
        SELECT
            v.IDProducto, v.Nombre, v.Descripcion, v.IDCategoria, v.Categoria,
            v.Activo, v.FechaCreacion, v.PrecioMinimo, v.PrecioMaximo,
            v.VariantesActivas, v.HayDisponible, v.DisponibleTotal, v.BajoStock, v.ImagenPrincipal,
            CAST(ISNULL(vt.Unidades, 0) AS INT) AS UnidadesVendidas,
            ROW_NUMBER() OVER (
                ORDER BY
                    CASE WHEN @HayVentas = 1 THEN ISNULL(vt.Unidades, 0) ELSE 0 END DESC,
                    CASE WHEN @HayVentas = 0 THEN v.FechaCreacion END DESC,
                    v.IDProducto ASC
            ) AS Posicion
        FROM #Visibles v
        LEFT JOIN #Ventas vt ON vt.IDProducto = v.IDProducto
    )
    SELECT TOP (@Limite)
        IDProducto, Nombre, Descripcion, IDCategoria, Categoria, Activo, FechaCreacion,
        PrecioMinimo, PrecioMaximo, VariantesActivas, HayDisponible, DisponibleTotal, BajoStock,
        ImagenPrincipal, UnidadesVendidas, CAST(Posicion AS INT) AS Posicion
    FROM Rankeados
    ORDER BY Posicion
    OPTION (RECOMPILE);

    /* Recordset 2: Ofertas (cupon de categoria vigente PORCENTAJE, mejor descuento por
       producto). Solo PORCENTAJE: los cupones de MONTO aplican una vez por carrito y pueden
       exigir monto minimo, por lo que un precio con cupon por unidad no seria real. */
    ;WITH CuponesCat AS (
        SELECT c.IDCategoria, c.Codigo, c.TipoDescuento, c.Valor, c.MontoMinimo, c.FechaFin
        FROM dbo.Cupon c
        WHERE c.Activo = 1
          AND c.IDCategoria IS NOT NULL
          AND c.TipoDescuento = N'PORCENTAJE'
          AND c.FechaInicio <= @Ahora
          AND c.FechaFin > @Ahora
          AND (c.LimiteUsosTotal IS NULL OR c.UsosActuales < c.LimiteUsosTotal)
    )
    SELECT TOP (@Limite)
        v.IDProducto, v.Nombre, v.Descripcion, v.IDCategoria, v.Categoria,
        v.Activo, v.FechaCreacion, v.PrecioMinimo, v.PrecioMaximo,
        v.VariantesActivas, v.HayDisponible, v.DisponibleTotal, v.BajoStock, v.ImagenPrincipal,
        mejor.Codigo        AS CuponCodigo,
        mejor.TipoDescuento,
        mejor.Valor,
        mejor.MontoMinimo,
        mejor.PrecioConCupon
    FROM #Visibles v
    CROSS APPLY (
        SELECT TOP (1)
            cc.Codigo, cc.TipoDescuento, cc.Valor, cc.MontoMinimo, cc.FechaFin,
            CAST(ROUND(v.PrecioMinimo * (1 - cc.Valor / 100.0), 2) AS DECIMAL(18,2)) AS PrecioConCupon
        FROM CuponesCat cc
        WHERE cc.IDCategoria = v.IDCategoria
        ORDER BY cc.Valor DESC, cc.FechaFin ASC
    ) mejor
    ORDER BY mejor.Valor DESC, v.Nombre ASC, v.IDProducto ASC
    OPTION (RECOMPILE);
END
GO
