/* ============================================================
   023_SP_Pedidos_Cliente.sql
   ShopCart - Fase 2: SPs de solo lectura para la pantalla "Mis pedidos" del
   cliente (listado enriquecido, resumen y pago). Aditivo: no altera los SPs de
   RF-07 (018). Todos filtran por @IDUsuario (el cliente dueno).

   Contenido:
     - SP_Pedidos_ListarCliente: pagina de pedidos del cliente con filtros
       (estado como lista separada por comas via STRING_SPLIT, numero), orden y
       paginacion OFFSET/FETCH; agrega CantidadLineas/Unidades, hasta 3 imagenes
       (Img1/Img2/Img3) y un resumen de nombres. Recordsets: (1) pagina, (2) Total.
     - SP_Pedidos_ResumenCliente: conteos por estado, total comprado (sin
       cancelados) y el pedido despachado mas reciente con su fecha estimada.
     - SP_Pedidos_PagoCliente: el pago aprobado del pedido (metodo, estado,
       referencia), con validacion de propiedad.

   Convenciones: NOCOUNT ON; sin SQL dinamico (filtros (@P IS NULL OR ...) +
   OPTION (RECOMPILE)); montos DECIMAL(18,2); mensajes en espanol sin acentos.
   Orden de ejecucion: 023 (despues de 018).
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Pedidos_ListarCliente
   @CodigoEstado: NULL = todos; o uno o varios codigos separados por coma
   (p. ej. 'PAGADO,EN_PREPARACION,DESPACHADO') que se parsean con STRING_SPLIT.
   @Numero: subcadena del NumeroPedido. @Orden: 'ASC' por fecha o 'DESC' (default).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarCliente
    @IDUsuario    INT,
    @CodigoEstado NVARCHAR(200) = NULL,
    @Numero       NVARCHAR(30)  = NULL,
    @Pagina       INT           = 1,
    @Tamano       INT           = 20,
    @Orden        NVARCHAR(4)   = NULL,
    @IDRol        INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @Tamano IS NULL OR @Tamano < 1 SET @Tamano = 20;
    IF @Tamano > 100 SET @Tamano = 100;

    -- Escapa los comodines de LIKE (% _ [) con clases [..] para que el numero buscado sea literal.
    DECLARE @Patron NVARCHAR(320) = CASE WHEN @Numero IS NULL THEN NULL
        ELSE CONCAT(N'%', REPLACE(REPLACE(REPLACE(@Numero, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]'), N'%') END;

    ;WITH Filtrados AS (
        SELECT
            p.IDPedido, p.NumeroPedido,
            ep.Codigo AS EstadoCodigo, ep.Nombre AS EstadoNombre,
            p.Subtotal, p.Descuento, p.CostoEnvio, p.Total,
            p.IDCupon, cup.Codigo AS CuponCodigo,
            p.FechaCreacion, p.FechaActualizacion
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        LEFT JOIN  dbo.Cupon cup       ON cup.IDCupon = p.IDCupon
        WHERE p.IDUsuario = @IDUsuario
          AND (@CodigoEstado IS NULL
               OR ep.Codigo IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@CodigoEstado, N',')))
          AND (@Patron IS NULL OR p.NumeroPedido LIKE @Patron)
    )
    SELECT
        f.IDPedido, f.NumeroPedido, f.EstadoCodigo, f.EstadoNombre,
        f.Subtotal, f.Descuento, f.CostoEnvio, f.Total,
        f.IDCupon, f.CuponCodigo, f.FechaCreacion, f.FechaActualizacion,
        ln.CantidadLineas, ln.CantidadUnidades, ln.UnidadesDevueltas,
        imgs.Img1, imgs.Img2, imgs.Img3,
        nom.NombresResumen,
        dbo.FU_Pedido_AccionesPermitidas(f.EstadoCodigo, @IDRol) AS AccionesPermitidas
    FROM Filtrados f
    CROSS APPLY (
        SELECT COUNT(1) AS CantidadLineas,
               ISNULL(SUM(pd.Cantidad), 0) AS CantidadUnidades,
               ISNULL(SUM(pd.CantidadDevuelta), 0) AS UnidadesDevueltas
        FROM dbo.PedidoDetalle pd WHERE pd.IDPedido = f.IDPedido
    ) ln
    OUTER APPLY (
        SELECT
            MAX(CASE WHEN rn = 1 THEN Url END) AS Img1,
            MAX(CASE WHEN rn = 2 THEN Url END) AS Img2,
            MAX(CASE WHEN rn = 3 THEN Url END) AS Img3
        FROM (
            SELECT TOP (3) COALESCE(v.ImagenURL, img.Url) AS Url, ROW_NUMBER() OVER (ORDER BY pd.IDVariante) AS rn
            FROM dbo.PedidoDetalle pd
            INNER JOIN dbo.Variante v ON v.IDVariante = pd.IDVariante
            OUTER APPLY (
                SELECT TOP (1) pi.Url FROM dbo.ProductoImagen pi
                WHERE pi.IDProducto = v.IDProducto
                ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
            ) img
            WHERE pd.IDPedido = f.IDPedido
            ORDER BY pd.IDVariante
        ) t
    ) imgs
    OUTER APPLY (
        /* 'A' / 'A y B' / 'A, B y N mas' construido en SQL (sin SQL dinamico). */
        SELECT CASE
                 WHEN cnt = 0 THEN NULL
                 WHEN cnt = 1 THEN n1
                 WHEN cnt = 2 THEN CONCAT(n1, N' y ', n2)
                 ELSE CONCAT(n1, N', ', n2, N' y ', cnt - 2, N' mas')
               END AS NombresResumen
        FROM (
            SELECT COUNT(1) AS cnt,
                   MAX(CASE WHEN ord = 1 THEN Nombre END) AS n1,
                   MAX(CASE WHEN ord = 2 THEN Nombre END) AS n2
            FROM (
                SELECT pd.NombreProducto AS Nombre,
                       ROW_NUMBER() OVER (ORDER BY pd.IDVariante) AS ord
                FROM dbo.PedidoDetalle pd WHERE pd.IDPedido = f.IDPedido
            ) x
        ) y
    ) nom
    ORDER BY
        CASE WHEN @Orden = N'ASC' THEN f.FechaCreacion END ASC,
        CASE WHEN @Orden = N'ASC' THEN f.IDPedido END ASC,
        f.FechaCreacion DESC, f.IDPedido DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Pedido p
    INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    WHERE p.IDUsuario = @IDUsuario
      AND (@CodigoEstado IS NULL
           OR ep.Codigo IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@CodigoEstado, N',')))
      AND (@Patron IS NULL OR p.NumeroPedido LIKE @Patron)
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_ResumenCliente
   Una fila: conteos por estado, total (todos), total comprado (sin cancelados) y
   el pedido DESPACHADO mas reciente con su fecha estimada de entrega (despacho + 2
   dias) y el ultimo ENTREGADO.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ResumenCliente
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH P AS (
        SELECT p.IDPedido, p.NumeroPedido, p.Total, ep.Codigo AS EstadoCodigo,
               p.FechaCreacion, p.FechaActualizacion
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDUsuario = @IDUsuario
    )
    SELECT
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'PAGADO'          THEN 1 ELSE 0 END), 0) AS Pagado,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'EN_PREPARACION'  THEN 1 ELSE 0 END), 0) AS EnPreparacion,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'DESPACHADO'      THEN 1 ELSE 0 END), 0) AS Despachado,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'ENTREGADO'       THEN 1 ELSE 0 END), 0) AS Entregado,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'CANCELADO'       THEN 1 ELSE 0 END), 0) AS Cancelado,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'DEVUELTO'        THEN 1 ELSE 0 END), 0) AS Devuelto,
        COUNT(1) AS Total,
        CAST(ISNULL(SUM(CASE WHEN EstadoCodigo <> N'CANCELADO' THEN Total ELSE 0 END), 0) AS DECIMAL(18,2)) AS TotalComprado,
        (SELECT TOP (1) NumeroPedido FROM P
         WHERE EstadoCodigo = N'DESPACHADO' ORDER BY FechaActualizacion DESC, IDPedido DESC) AS DespachadoNumero,
        (SELECT TOP (1) DATEADD(DAY, 2, ISNULL(FechaActualizacion, FechaCreacion)) FROM P
         WHERE EstadoCodigo = N'DESPACHADO' ORDER BY FechaActualizacion DESC, IDPedido DESC) AS DespachadoFechaEstimada,
        (SELECT TOP (1) ISNULL(FechaActualizacion, FechaCreacion) FROM P
         WHERE EstadoCodigo = N'ENTREGADO' ORDER BY FechaActualizacion DESC, IDPedido DESC) AS UltimoEntregadoFecha
    FROM P;
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_PagoCliente
   El pago APROBADO del pedido (hay a lo sumo uno por UQ de clave + regla de negocio).
   @IDUsuario valida la propiedad (NULL para Operador/Admin). La referencia es la
   clave de idempotencia; el pago es simulado, no hay datos de tarjeta.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_PagoCliente
    @IDPedido  INT,
    @IDUsuario INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1)
        pg.IDPago, pg.MetodoPago, pg.Estado, pg.Monto,
        pg.ClaveIdempotencia AS Referencia, pg.Fecha
    FROM dbo.Pago pg
    INNER JOIN dbo.Pedido p ON p.IDPedido = pg.IDPedido
    WHERE pg.IDPedido = @IDPedido
      AND pg.Estado = N'Aprobado'
      AND (@IDUsuario IS NULL OR p.IDUsuario = @IDUsuario)
    ORDER BY pg.Fecha DESC, pg.IDPago DESC;
END
GO
