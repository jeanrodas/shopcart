/* ============================================================
   020_Reportes.sql
   ShopCart - Dashboard y reportes (RF-08).

   Reglas de negocio (fijas):
     - Pedido completado = estado DISTINTO de CANCELADO (incluye DEVUELTO: cuenta
       como venta con su devolucion descontada).
     - Las devoluciones se DESCUENTAN:
         * Venta neta del pedido = Total - SUM(Devolucion.MontoReintegrado).
         * Unidades netas de linea  = Cantidad - CantidadDevuelta.
         * Monto neto de linea      = TotalLinea prorrateado por la cantidad neta
                                      = ROUND(TotalLinea * (Cantidad - CantidadDevuelta) / Cantidad, 2).
     - Periodos en UTC por Pedido.FechaCreacion. Rango SIEMPRE semiabierto
       [@Desde, @Hasta): incluye @Desde y EXCLUYE @Hasta (asi un pedido en el limite
       no cuenta en dos periodos contiguos). Ticket promedio = venta neta / pedidos
       completados del periodo.
     - Carrito abandonado = Estado 'Activo', >= 1 linea y FechaUltimaActividad
       anterior a (ahora - CARRITO_ABANDONO_HORAS de dbo.Parametro).
     - ProductosBajoStock = variantes activas con Disponible <= STOCK_MINIMO
       (dbo.Parametro) segun VW_Inventario_Disponible.
     - El listado de pedidos con filtros de RF-08 ya lo cubre GET /pedidos (M7):
       aqui NO se duplica.

   Convenciones: ver 016/018/019 (NOCOUNT; XACT_ABORT solo en SPs con TRAN -aqui
   todo es solo lectura, sin TRAN-; errores 50400-50499; mensajes sin acentos;
   patron (@P IS NULL OR ...) + OPTION (RECOMPILE)). Sin SQL dinamico. Montos
   DECIMAL(18,2). Requiere SQL Server 2022 (DATETRUNC).

   Orden de ejecucion M9: 020 (despues de 019). Idempotente: CREATE OR ALTER en
   vistas y SPs; los indices se crean solo si faltan.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   VW_Reportes_PedidoNeto
   Un renglon por pedido completado (estado <> CANCELADO) con su venta bruta,
   lo devuelto y la venta neta.
   ------------------------------------------------------------ */
CREATE OR ALTER VIEW dbo.VW_Reportes_PedidoNeto
AS
SELECT
    p.IDPedido,
    p.FechaCreacion,
    p.IDUsuario,
    p.IDEstadoPedido,
    p.Total,
    CAST(ISNULL(dev.Devuelto, 0) AS DECIMAL(18,2))          AS Devuelto,
    CAST(p.Total - ISNULL(dev.Devuelto, 0) AS DECIMAL(18,2)) AS VentaNeta
FROM dbo.Pedido p
INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
OUTER APPLY (
    SELECT SUM(d.MontoReintegrado) AS Devuelto
    FROM dbo.Devolucion d
    WHERE d.IDPedido = p.IDPedido
) dev
WHERE ep.Codigo <> N'CANCELADO';
GO

/* ------------------------------------------------------------
   VW_Reportes_LineaNeta
   Un renglon por linea de pedido completado, con unidades y monto netos de la
   devolucion. IDProducto se obtiene de la variante (PedidoDetalle guarda IDVariante
   e IDCategoria como snapshot, no IDProducto).
   ------------------------------------------------------------ */
CREATE OR ALTER VIEW dbo.VW_Reportes_LineaNeta
AS
SELECT
    p.IDPedido,
    p.FechaCreacion                                          AS Fecha,
    pd.IDCategoria,
    v.IDProducto,
    pd.IDVariante,
    (pd.Cantidad - pd.CantidadDevuelta)                      AS CantidadNeta,
    CAST(ROUND(pd.TotalLinea * (pd.Cantidad - pd.CantidadDevuelta) / pd.Cantidad, 2)
         AS DECIMAL(18,2))                                   AS MontoNeto
FROM dbo.Pedido p
INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
INNER JOIN dbo.PedidoDetalle pd ON pd.IDPedido = p.IDPedido
INNER JOIN dbo.Variante v       ON v.IDVariante = pd.IDVariante
WHERE ep.Codigo <> N'CANCELADO';
GO

/* ------------------------------------------------------------
   SP_Reportes_VentasPorPeriodo
   Agrupa la venta neta por DIA, SEMANA o MES usando DATETRUNC (SQL Server 2022).
   Valida @Hasta > @Desde, rango <= 366 dias y agrupacion valida -> 50400.
   La semana usa DATEFIRST 1 (inicia lunes) para un corte determinista.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_VentasPorPeriodo
    @Desde      DATETIME2(0),
    @Hasta      DATETIME2(0),
    @Agrupacion NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SET DATEFIRST 1;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;
    IF @Agrupacion NOT IN (N'DIA', N'SEMANA', N'MES')
        THROW 50400, 'La agrupacion debe ser DIA, SEMANA o MES', 1;

    SELECT
        CAST(
            CASE @Agrupacion
                WHEN N'DIA'    THEN DATETRUNC(DAY,   pn.FechaCreacion)
                WHEN N'SEMANA' THEN DATETRUNC(WEEK,  pn.FechaCreacion)
                ELSE                DATETRUNC(MONTH, pn.FechaCreacion)
            END AS DATE)                                      AS Periodo,
        COUNT(1)                                              AS Pedidos,
        CAST(SUM(pn.Total)     AS DECIMAL(18,2))              AS VentaBruta,
        CAST(SUM(pn.Devuelto)  AS DECIMAL(18,2))              AS Devoluciones,
        CAST(SUM(pn.VentaNeta) AS DECIMAL(18,2))              AS VentaNeta,
        CAST(SUM(pn.VentaNeta) / COUNT(1) AS DECIMAL(18,2))   AS TicketPromedio
    FROM dbo.VW_Reportes_PedidoNeto pn
    WHERE pn.FechaCreacion >= @Desde
      AND pn.FechaCreacion < @Hasta
    GROUP BY
        CASE @Agrupacion
            WHEN N'DIA'    THEN DATETRUNC(DAY,   pn.FechaCreacion)
            WHEN N'SEMANA' THEN DATETRUNC(WEEK,  pn.FechaCreacion)
            ELSE                DATETRUNC(MONTH, pn.FechaCreacion)
        END
    ORDER BY Periodo
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Reportes_VentasPorCategoria
   Venta neta por categoria en el rango. Orden por MontoNeto DESC.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_VentasPorCategoria
    @Desde DATETIME2(0),
    @Hasta DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    SELECT
        ln.IDCategoria,
        c.Nombre                                   AS Categoria,
        COUNT(DISTINCT ln.IDPedido)                AS Pedidos,
        SUM(ln.CantidadNeta)                       AS UnidadesNetas,
        CAST(SUM(ln.MontoNeto) AS DECIMAL(18,2))   AS MontoNeto
    FROM dbo.VW_Reportes_LineaNeta ln
    INNER JOIN dbo.Categoria c ON c.IDCategoria = ln.IDCategoria
    WHERE ln.Fecha >= @Desde
      AND ln.Fecha < @Hasta
    GROUP BY ln.IDCategoria, c.Nombre
    ORDER BY MontoNeto DESC, Categoria, ln.IDCategoria
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Reportes_TopProductos
   Los @Top productos mas vendidos (unidades netas) en el rango.
   @Top se acota a 1-50. Orden UnidadesNetas DESC, MontoNeto DESC.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_TopProductos
    @Desde DATETIME2(0),
    @Hasta DATETIME2(0),
    @Top   INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    IF @Top IS NULL OR @Top < 1 SET @Top = 10;
    IF @Top > 50 SET @Top = 50;

    SELECT TOP (@Top)
        ln.IDProducto,
        pr.Nombre                                  AS Producto,
        c.Nombre                                   AS Categoria,
        SUM(ln.CantidadNeta)                       AS UnidadesNetas,
        CAST(SUM(ln.MontoNeto) AS DECIMAL(18,2))   AS MontoNeto
    FROM dbo.VW_Reportes_LineaNeta ln
    INNER JOIN dbo.Producto pr  ON pr.IDProducto = ln.IDProducto
    -- Categoria del SNAPSHOT de la linea (ln.IDCategoria), no la actual del producto.
    INNER JOIN dbo.Categoria c  ON c.IDCategoria = ln.IDCategoria
    WHERE ln.Fecha >= @Desde
      AND ln.Fecha < @Hasta
    GROUP BY ln.IDProducto, pr.Nombre, ln.IDCategoria, c.Nombre
    ORDER BY UnidadesNetas DESC, MontoNeto DESC, ln.IDProducto
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Reportes_CarritosAbandonados
   Carritos 'Activo' con >= 1 linea e inactividad mayor al parametro de abandono.
   ValorEstimado usa el precio ACTUAL de la variante. Recordset 2 = Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_CarritosAbandonados
    @Pagina       INT = 1,
    @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Horas INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'CARRITO_ABANDONO_HORAS') AS INT), 24);
    DECLARE @Limite DATETIME2(0) = DATEADD(HOUR, -@Horas, SYSUTCDATETIME());
    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;

    ;WITH Abandonados AS (
        SELECT
            car.IDCarrito,
            ISNULL(u.Nombre, N'Invitado')                  AS Cliente,
            u.Correo                                       AS Correo,
            COUNT(cd.IDCarritoDetalle)                     AS Lineas,
            SUM(cd.Cantidad)                               AS Unidades,
            CAST(SUM(v.Precio * cd.Cantidad) AS DECIMAL(18,2)) AS ValorEstimado,
            car.FechaUltimaActividad,
            DATEDIFF(HOUR, car.FechaUltimaActividad, SYSUTCDATETIME()) AS HorasInactivo
        FROM dbo.Carrito car
        INNER JOIN dbo.CarritoDetalle cd ON cd.IDCarrito = car.IDCarrito
        INNER JOIN dbo.Variante v        ON v.IDVariante = cd.IDVariante
        LEFT JOIN  dbo.Usuario u         ON u.IDUsuario = car.IDUsuario
        WHERE car.Estado = N'Activo'
          AND car.FechaUltimaActividad < @Limite
        GROUP BY car.IDCarrito, u.Nombre, u.Correo, car.FechaUltimaActividad
    )
    SELECT IDCarrito, Cliente, Correo, Lineas, Unidades, ValorEstimado,
           FechaUltimaActividad, HorasInactivo
    FROM Abandonados
    ORDER BY FechaUltimaActividad ASC, IDCarrito ASC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Carrito car
    WHERE car.Estado = N'Activo'
      AND car.FechaUltimaActividad < @Limite
      AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle cd WHERE cd.IDCarrito = car.IDCarrito);
END
GO

/* ------------------------------------------------------------
   SP_Reportes_Resumen
   Una fila con los indicadores del periodo actual y el comparativo con el periodo
   inmediatamente anterior de IGUAL longitud ([@Desde - (Hasta-Desde), @Desde)).
   Variaciones NULL cuando el valor anterior es 0. Incluye carritos abandonados
   (conteo actual) y productos bajo stock.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Reportes_Resumen
    @Desde DATETIME2(0),
    @Hasta DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    DECLARE @Segundos INT = DATEDIFF(SECOND, @Desde, @Hasta);
    DECLARE @DesdeAnterior DATETIME2(0) = DATEADD(SECOND, -@Segundos, @Desde);

    DECLARE @Horas INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'CARRITO_ABANDONO_HORAS') AS INT), 24);
    DECLARE @LimiteAbandono DATETIME2(0) = DATEADD(HOUR, -@Horas, SYSUTCDATETIME());
    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);

    /* Periodo actual. */
    DECLARE @Pedidos INT, @VentaNeta DECIMAL(18,2), @UnidadesNetas INT;
    SELECT @Pedidos = COUNT(1), @VentaNeta = CAST(ISNULL(SUM(VentaNeta), 0) AS DECIMAL(18,2))
    FROM dbo.VW_Reportes_PedidoNeto
    WHERE FechaCreacion >= @Desde AND FechaCreacion < @Hasta;

    SELECT @UnidadesNetas = ISNULL(SUM(CantidadNeta), 0)
    FROM dbo.VW_Reportes_LineaNeta
    WHERE Fecha >= @Desde AND Fecha < @Hasta;

    /* Periodo anterior (misma longitud, sin solapar el actual). */
    DECLARE @PedidosAnterior INT, @VentaNetaAnterior DECIMAL(18,2);
    SELECT @PedidosAnterior = COUNT(1),
           @VentaNetaAnterior = CAST(ISNULL(SUM(VentaNeta), 0) AS DECIMAL(18,2))
    FROM dbo.VW_Reportes_PedidoNeto
    WHERE FechaCreacion >= @DesdeAnterior AND FechaCreacion < @Desde;

    SELECT
        @Pedidos        AS Pedidos,
        @VentaNeta      AS VentaNeta,
        CAST(CASE WHEN @Pedidos = 0 THEN 0 ELSE @VentaNeta / @Pedidos END AS DECIMAL(18,2)) AS TicketPromedio,
        @UnidadesNetas  AS UnidadesNetas,
        @PedidosAnterior   AS PedidosAnterior,
        @VentaNetaAnterior AS VentaNetaAnterior,
        CASE WHEN @PedidosAnterior = 0 THEN NULL
             ELSE CAST((@Pedidos - @PedidosAnterior) * 100.0 / @PedidosAnterior AS DECIMAL(9,2)) END AS VariacionPedidosPct,
        CASE WHEN @VentaNetaAnterior = 0 THEN NULL
             ELSE CAST((@VentaNeta - @VentaNetaAnterior) * 100.0 / @VentaNetaAnterior AS DECIMAL(9,2)) END AS VariacionVentaPct,
        (SELECT COUNT(1)
           FROM dbo.Carrito car
          WHERE car.Estado = N'Activo'
            AND car.FechaUltimaActividad < @LimiteAbandono
            AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle cd WHERE cd.IDCarrito = car.IDCarrito)) AS CarritosAbandonados,
        (SELECT COUNT(1)
           FROM dbo.VW_Inventario_Disponible inv
          WHERE inv.Activo = 1 AND inv.Disponible <= @StockMin)                                 AS VariantesBajoStock;
END
GO

/* ------------------------------------------------------------
   Indices de apoyo.
   Ya existen desde 001: IX_Pedido_FechaEstado, IX_PedidoDetalle_Variante,
   IX_PedidoDetalle_Categoria, IX_Carrito_Abandono, IX_Devolucion_Pedido.
   Se agrega solo lo que falta: un indice que cubra la suma de MontoReintegrado por
   pedido (VW_Reportes_PedidoNeto), para no leer la fila base de Devolucion.
   ------------------------------------------------------------ */
IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_Devolucion_Pedido_Monto'
          AND object_id = OBJECT_ID(N'dbo.Devolucion'))
    CREATE NONCLUSTERED INDEX IX_Devolucion_Pedido_Monto
        ON dbo.Devolucion (IDPedido)
        INCLUDE (MontoReintegrado);
GO
