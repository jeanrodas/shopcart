/* ============================================================
   028_SP_Fase2_Dashboard.sql
   ShopCart - Fase 2 (F9). Datos del dashboard del area interna.

   Aditivo sobre M9 (020). Solo agrega lo que los reportes de M9 NO cubren:
     - SP_Dashboard_Resumen       : 4 KPIs con su valor del periodo anterior y
                                     VariacionPct calculada en SQL (020 solo trae
                                     comparativo de Pedidos y VentaNeta).
     - SP_Dashboard_VentasPorDia  : serie diaria CON ceros en dias sin ventas
                                     (020 omite los dias vacios). Tabla de numeros
                                     por CTE recursiva (no cursor).
     - SP_Dashboard_VentasPorCategoria : como 020 + Porcentaje del total.
     - SP_Dashboard_Embudo        : carritos creados / con lineas / checkouts /
                                     pagos aprobados / rechazados, con tasas en SQL.
     - SP_Dashboard_HorasPico     : pedidos por dia de semana (1=Lun..7=Dom) y hora
                                     (0-23 UTC). Solo celdas con pedidos.
     - SP_Dashboard_Cupones       : cupones mas usados en el periodo con el descuento
                                     otorgado (020 no tiene reporte de cupones por rango).
     - SP_Eventos_EstadoVariante  : SKU/Disponible/Umbral/BajoStock de una variante,
                                     para construir el evento SSE inventario.* sin
                                     SQL en TypeScript.

   Top productos se REUSA de 020 (SP_Reportes_TopProductos) desde un endpoint
   /dashboard/top-productos que permite Operador; aqui no se duplica.

   Reglas de ventas identicas a 020: pedido completado = estado <> CANCELADO,
   devoluciones descontadas, rango SIEMPRE semiabierto [@Desde, @Hasta) en UTC.
   Convenciones: NOCOUNT; sin TRAN (solo lectura); THROW 50400 por rango invalido;
   mensajes sin acentos; OPTION (RECOMPILE). SQL Server 2022.

   Orden de ejecucion: 028 DESPUES de 020 y 026 (usa VW_Reportes_* y las tablas base).
   Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Dashboard_Resumen
   Una fila: VentasNetas, Pedidos, TicketPromedio, UnidadesVendidas, cada uno con
   su valor del periodo anterior (misma longitud, sin solapar) y VariacionPct en SQL.
   La variacion es NULL cuando el valor anterior es 0 (igual que 020).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_Resumen
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
    DECLARE @DesdeAnt DATETIME2(0) = DATEADD(SECOND, -@Segundos, @Desde);

    DECLARE @Pedidos INT, @Ventas DECIMAL(18,2), @Unidades INT;
    DECLARE @PedidosAnt INT, @VentasAnt DECIMAL(18,2), @UnidadesAnt INT;

    SELECT @Pedidos = COUNT(1),
           @Ventas  = CAST(ISNULL(SUM(VentaNeta), 0) AS DECIMAL(18,2))
    FROM dbo.VW_Reportes_PedidoNeto
    WHERE FechaCreacion >= @Desde AND FechaCreacion < @Hasta;

    SELECT @Unidades = ISNULL(SUM(CantidadNeta), 0)
    FROM dbo.VW_Reportes_LineaNeta
    WHERE Fecha >= @Desde AND Fecha < @Hasta;

    SELECT @PedidosAnt = COUNT(1),
           @VentasAnt  = CAST(ISNULL(SUM(VentaNeta), 0) AS DECIMAL(18,2))
    FROM dbo.VW_Reportes_PedidoNeto
    WHERE FechaCreacion >= @DesdeAnt AND FechaCreacion < @Desde;

    SELECT @UnidadesAnt = ISNULL(SUM(CantidadNeta), 0)
    FROM dbo.VW_Reportes_LineaNeta
    WHERE Fecha >= @DesdeAnt AND Fecha < @Desde;

    DECLARE @Ticket    DECIMAL(18,2) = CASE WHEN @Pedidos    = 0 THEN 0 ELSE CAST(@Ventas    / @Pedidos    AS DECIMAL(18,2)) END;
    DECLARE @TicketAnt DECIMAL(18,2) = CASE WHEN @PedidosAnt = 0 THEN 0 ELSE CAST(@VentasAnt / @PedidosAnt AS DECIMAL(18,2)) END;

    SELECT
        @Ventas       AS VentasNetas,
        @VentasAnt    AS VentasNetasAnterior,
        CASE WHEN @VentasAnt = 0 THEN NULL
             ELSE CAST((@Ventas - @VentasAnt) * 100.0 / @VentasAnt AS DECIMAL(9,2)) END   AS VariacionVentasPct,
        @Pedidos      AS Pedidos,
        @PedidosAnt   AS PedidosAnterior,
        CASE WHEN @PedidosAnt = 0 THEN NULL
             ELSE CAST((@Pedidos - @PedidosAnt) * 100.0 / @PedidosAnt AS DECIMAL(9,2)) END AS VariacionPedidosPct,
        @Ticket       AS TicketPromedio,
        @TicketAnt    AS TicketPromedioAnterior,
        CASE WHEN @TicketAnt = 0 THEN NULL
             ELSE CAST((@Ticket - @TicketAnt) * 100.0 / @TicketAnt AS DECIMAL(9,2)) END    AS VariacionTicketPct,
        @Unidades     AS UnidadesVendidas,
        @UnidadesAnt  AS UnidadesVendidasAnterior,
        CASE WHEN @UnidadesAnt = 0 THEN NULL
             ELSE CAST((@Unidades - @UnidadesAnt) * 100.0 / @UnidadesAnt AS DECIMAL(9,2)) END AS VariacionUnidadesPct;
END
GO

/* ------------------------------------------------------------
   SP_Dashboard_VentasPorDia
   Serie diaria [@Desde, @Hasta) con un renglon por dia, 0 en los dias sin ventas.
   Los dias se generan con una CTE recursiva (tabla de numeros, no cursor); el tope
   de 366 dias garantiza MAXRECURSION suficiente.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorDia
    @Desde        DATETIME2(0),
    @Hasta        DATETIME2(0),
    @Granularidad NVARCHAR(10) = N'DIA'  -- DIA | SEMANA | MES (agrupa con DATETRUNC, como M9)
AS
BEGIN
    SET NOCOUNT ON;
    SET DATEFIRST 1;  -- semana inicia lunes (corte determinista, igual que 020)

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    DECLARE @Gran NVARCHAR(10) = UPPER(ISNULL(@Granularidad, N'DIA'));
    IF @Gran NOT IN (N'DIA', N'SEMANA', N'MES')
        THROW 50422, 'La granularidad debe ser DIA, SEMANA o MES', 1;

    DECLARE @Ini DATE = CAST(@Desde AS DATE);
    DECLARE @Fin DATE = CAST(DATEADD(SECOND, -1, @Hasta) AS DATE); -- ultimo dia incluido

    -- Serie de periodos CON ceros: se truncan todos los dias del rango a la granularidad y se
    -- toman distintos; el inicio de periodo (Fecha) es la fecha truncada. Sin SQL dinamico: el
    -- datepart de DATETRUNC no admite variable, por eso el CASE por @Gran (patron de 020).
    ;WITH Dias AS (
        SELECT @Ini AS Dia
        UNION ALL
        SELECT DATEADD(DAY, 1, Dia) FROM Dias WHERE Dia < @Fin
    ),
    Periodos AS (
        SELECT DISTINCT CAST(CASE @Gran
                   WHEN N'SEMANA' THEN DATETRUNC(WEEK,  Dia)
                   WHEN N'MES'    THEN DATETRUNC(MONTH, Dia)
                   ELSE                DATETRUNC(DAY,   Dia) END AS DATE) AS Periodo
        FROM Dias
    ),
    Ventas AS (
        SELECT CAST(CASE @Gran
                   WHEN N'SEMANA' THEN DATETRUNC(WEEK,  pn.FechaCreacion)
                   WHEN N'MES'    THEN DATETRUNC(MONTH, pn.FechaCreacion)
                   ELSE                DATETRUNC(DAY,   pn.FechaCreacion) END AS DATE) AS Periodo,
               COUNT(1)                                      AS Pedidos,
               CAST(SUM(pn.VentaNeta) AS DECIMAL(18,2))      AS VentaNeta
        FROM dbo.VW_Reportes_PedidoNeto pn
        WHERE pn.FechaCreacion >= @Desde AND pn.FechaCreacion < @Hasta
        GROUP BY CASE @Gran
                   WHEN N'SEMANA' THEN DATETRUNC(WEEK,  pn.FechaCreacion)
                   WHEN N'MES'    THEN DATETRUNC(MONTH, pn.FechaCreacion)
                   ELSE                DATETRUNC(DAY,   pn.FechaCreacion) END
    ),
    Unidades AS (
        SELECT CAST(CASE @Gran
                   WHEN N'SEMANA' THEN DATETRUNC(WEEK,  ln.Fecha)
                   WHEN N'MES'    THEN DATETRUNC(MONTH, ln.Fecha)
                   ELSE                DATETRUNC(DAY,   ln.Fecha) END AS DATE) AS Periodo,
               SUM(ln.CantidadNeta)                          AS UnidadesNetas
        FROM dbo.VW_Reportes_LineaNeta ln
        WHERE ln.Fecha >= @Desde AND ln.Fecha < @Hasta
        GROUP BY CASE @Gran
                   WHEN N'SEMANA' THEN DATETRUNC(WEEK,  ln.Fecha)
                   WHEN N'MES'    THEN DATETRUNC(MONTH, ln.Fecha)
                   ELSE                DATETRUNC(DAY,   ln.Fecha) END
    )
    SELECT
        p.Periodo                                      AS Fecha,
        ISNULL(v.Pedidos, 0)                           AS Pedidos,
        CAST(ISNULL(v.VentaNeta, 0) AS DECIMAL(18,2))  AS VentaNeta,
        ISNULL(u.UnidadesNetas, 0)                     AS UnidadesNetas,
        CAST(CASE WHEN ISNULL(v.Pedidos, 0) = 0 THEN 0
                  ELSE v.VentaNeta / v.Pedidos END AS DECIMAL(18,2)) AS TicketPromedio
    FROM Periodos p
    LEFT JOIN Ventas v   ON v.Periodo = p.Periodo
    LEFT JOIN Unidades u ON u.Periodo = p.Periodo
    ORDER BY p.Periodo
    OPTION (MAXRECURSION 366);
END
GO

/* ------------------------------------------------------------
   SP_Dashboard_VentasPorCategoria
   Como SP_Reportes_VentasPorCategoria (020) pero agrega Porcentaje del total del
   periodo (calculado en SQL). Orden por MontoNeto DESC.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_VentasPorCategoria
    @Desde DATETIME2(0),
    @Hasta DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    DECLARE @Total DECIMAL(18,2);
    SELECT @Total = CAST(ISNULL(SUM(ln.MontoNeto), 0) AS DECIMAL(18,2))
    FROM dbo.VW_Reportes_LineaNeta ln
    WHERE ln.Fecha >= @Desde AND ln.Fecha < @Hasta;

    SELECT
        ln.IDCategoria,
        c.Nombre                                       AS Categoria,
        COUNT(DISTINCT ln.IDPedido)                    AS Pedidos,
        SUM(ln.CantidadNeta)                           AS UnidadesNetas,
        CAST(SUM(ln.MontoNeto) AS DECIMAL(18,2))       AS MontoNeto,
        CASE WHEN @Total = 0 THEN 0
             ELSE CAST(SUM(ln.MontoNeto) * 100.0 / @Total AS DECIMAL(9,2)) END AS Porcentaje
    FROM dbo.VW_Reportes_LineaNeta ln
    INNER JOIN dbo.Categoria c ON c.IDCategoria = ln.IDCategoria
    WHERE ln.Fecha >= @Desde AND ln.Fecha < @Hasta
    GROUP BY ln.IDCategoria, c.Nombre
    ORDER BY MontoNeto DESC, Categoria, ln.IDCategoria
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Dashboard_Embudo
   Embudo de compra en [@Desde, @Hasta): carritos creados, con lineas, checkouts
   iniciados (carritos con reserva creada en el rango), pagos aprobados y rechazados,
   con las tasas entre pasos calculadas en SQL (NULL si el denominador es 0).
   Los pasos de pago usan dbo.Pago.Estado ('Aprobado' / 'Rechazado').
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_Embudo
    @Desde DATETIME2(0),
    @Hasta DATETIME2(0)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    DECLARE @Creados INT, @ConLineas INT, @Checkouts INT, @Aprobados INT, @Rechazados INT;

    SELECT @Creados = COUNT(1)
    FROM dbo.Carrito
    WHERE FechaCreacion >= @Desde AND FechaCreacion < @Hasta;

    SELECT @ConLineas = COUNT(1)
    FROM dbo.Carrito car
    WHERE car.FechaCreacion >= @Desde AND car.FechaCreacion < @Hasta
      AND EXISTS (SELECT 1 FROM dbo.CarritoDetalle cd WHERE cd.IDCarrito = car.IDCarrito);

    SELECT @Checkouts = COUNT(DISTINCT r.IDCarrito)
    FROM dbo.Reserva r
    WHERE r.FechaCreacion >= @Desde AND r.FechaCreacion < @Hasta;

    SELECT @Aprobados = COUNT(1)
    FROM dbo.Pago
    WHERE Estado = N'Aprobado' AND Fecha >= @Desde AND Fecha < @Hasta;

    SELECT @Rechazados = COUNT(1)
    FROM dbo.Pago
    WHERE Estado = N'Rechazado' AND Fecha >= @Desde AND Fecha < @Hasta;

    SELECT
        @Creados     AS CarritosCreados,
        @ConLineas   AS CarritosConLineas,
        @Checkouts   AS CheckoutsIniciados,
        @Aprobados   AS PagosAprobados,
        @Rechazados  AS PagosRechazados,
        CASE WHEN @Creados = 0   THEN NULL ELSE CAST(@ConLineas  * 100.0 / @Creados   AS DECIMAL(9,2)) END AS TasaConLineas,
        CASE WHEN @ConLineas = 0 THEN NULL ELSE CAST(@Checkouts  * 100.0 / @ConLineas AS DECIMAL(9,2)) END AS TasaCheckout,
        CASE WHEN @Checkouts = 0 THEN NULL ELSE CAST(@Aprobados  * 100.0 / @Checkouts AS DECIMAL(9,2)) END AS TasaAprobacion,
        CASE WHEN (@Aprobados + @Rechazados) = 0 THEN NULL
             ELSE CAST(@Rechazados * 100.0 / (@Aprobados + @Rechazados) AS DECIMAL(9,2)) END AS TasaRechazo;
END
GO

/* ------------------------------------------------------------
   SP_Dashboard_HorasPico
   Pedidos completados por dia de la semana (1=Lunes..7=Domingo, con DATEFIRST 1) y
   hora del dia (0-23) en HORA LOCAL. @ZonaHoraria (nombre de sys.time_zone_info; por
   defecto Guatemala) se valida -> 50422; la FechaCreacion (UTC) se convierte con
   AT TIME ZONE antes de DATEPART. El rango se filtra en UTC (no cambia). Solo devuelve
   celdas con al menos un pedido; el navegador arma la matriz 7x24 (las ausentes son 0).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_HorasPico
    @Desde       DATETIME2(0),
    @Hasta       DATETIME2(0),
    @ZonaHoraria NVARCHAR(64) = N'Central America Standard Time'
AS
BEGIN
    SET NOCOUNT ON;
    SET DATEFIRST 1;  -- lunes = 1, determinista

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;
    IF @ZonaHoraria IS NULL OR NOT EXISTS (SELECT 1 FROM sys.time_zone_info WHERE name = @ZonaHoraria)
        THROW 50422, 'Zona horaria invalida', 1;

    SELECT
        DATEPART(WEEKDAY, l.FechaLocal) AS DiaSemana,
        DATEPART(HOUR, l.FechaLocal)    AS Hora,
        COUNT(1)                        AS Pedidos
    FROM dbo.VW_Reportes_PedidoNeto pn
    CROSS APPLY (
        SELECT CAST(pn.FechaCreacion AT TIME ZONE 'UTC' AT TIME ZONE @ZonaHoraria AS DATETIME2(0)) AS FechaLocal
    ) l
    WHERE pn.FechaCreacion >= @Desde AND pn.FechaCreacion < @Hasta
    GROUP BY DATEPART(WEEKDAY, l.FechaLocal), DATEPART(HOUR, l.FechaLocal)
    ORDER BY DiaSemana, Hora
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Dashboard_Cupones
   Los @Top cupones mas usados en [@Desde, @Hasta) con el descuento otorgado (suma de
   Pedido.Descuento de los pedidos no cancelados que usaron el cupon en el periodo).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_Cupones
    @Desde DATETIME2(0),
    @Hasta DATETIME2(0),
    @Top   INT = 8
AS
BEGIN
    SET NOCOUNT ON;

    IF @Desde IS NULL OR @Hasta IS NULL OR @Hasta <= @Desde
        THROW 50400, 'El rango de fechas es invalido (Hasta debe ser posterior a Desde)', 1;
    IF DATEDIFF(DAY, @Desde, @Hasta) > 366
        THROW 50400, 'El rango de fechas no puede exceder 366 dias', 1;

    IF @Top IS NULL OR @Top < 1 SET @Top = 8;
    IF @Top > 50 SET @Top = 50;

    SELECT TOP (@Top)
        c.IDCupon,
        c.Codigo,
        COUNT(1)                                         AS Usos,
        CAST(ISNULL(SUM(p.Descuento), 0) AS DECIMAL(18,2)) AS DescuentoOtorgado
    FROM dbo.CuponUso cu
    INNER JOIN dbo.Cupon c        ON c.IDCupon = cu.IDCupon
    INNER JOIN dbo.Pedido p       ON p.IDPedido = cu.IDPedido
    INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    WHERE cu.Fecha >= @Desde AND cu.Fecha < @Hasta
      AND ep.Codigo <> N'CANCELADO'
    GROUP BY c.IDCupon, c.Codigo
    ORDER BY Usos DESC, DescuentoOtorgado DESC, c.Codigo
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Dashboard_TopProductos
   Envoltorio de SP_Reportes_TopProductos (020) que agrega la ImagenPrincipal del producto
   (ProductoImagen: principal, luego orden). No altera M9; el dashboard usa este para mostrar
   la miniatura. Misma logica de ranking que 020.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Dashboard_TopProductos
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
        CAST(SUM(ln.MontoNeto) AS DECIMAL(18,2))   AS MontoNeto,
        (SELECT TOP (1) pi.Url
           FROM dbo.ProductoImagen pi
          WHERE pi.IDProducto = ln.IDProducto
          ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC) AS ImagenPrincipal
    FROM dbo.VW_Reportes_LineaNeta ln
    INNER JOIN dbo.Producto pr  ON pr.IDProducto = ln.IDProducto
    INNER JOIN dbo.Categoria c  ON c.IDCategoria = ln.IDCategoria
    WHERE ln.Fecha >= @Desde
      AND ln.Fecha < @Hasta
    GROUP BY ln.IDProducto, pr.Nombre, ln.IDCategoria, c.Nombre
    ORDER BY UnidadesNetas DESC, MontoNeto DESC, ln.IDProducto
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Sistema_Instalacion
   Fecha de creacion de la BD actual (sys.databases.create_date). El evento SSE "hola" la
   envia; el cliente descarta su feed si cambia (p. ej. la BD fue reinstalada). Solo lectura.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_Instalacion
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CONVERT(NVARCHAR(33), create_date, 126) AS Instalacion
    FROM sys.databases
    WHERE database_id = DB_ID();
END
GO

/* ------------------------------------------------------------
   SP_Eventos_EstadoVariante
   Estado actual de una variante para armar el evento SSE inventario.* (sin SQL en
   TypeScript): SKU, Disponible, Umbral (STOCK_MINIMO) y si quedo bajo stock.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Eventos_EstadoVariante
    @IDVariante INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);

    SELECT
        inv.SKU,
        inv.Disponible,
        @StockMin                                                                        AS Umbral,
        CAST(CASE WHEN inv.Activo = 1 AND inv.Disponible <= @StockMin THEN 1 ELSE 0 END AS BIT) AS BajoStock
    FROM dbo.VW_Inventario_Disponible inv
    WHERE inv.IDVariante = @IDVariante;
END
GO
