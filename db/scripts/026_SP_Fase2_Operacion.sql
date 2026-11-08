/* ============================================================
   026_SP_Fase2_Operacion.sql
   ShopCart - Fase 2 (aditivo): operacion de inventario y pedidos para el area
   interna (Administrador y Operador).

   Nada aqui altera el comportamiento ni las firmas de los SPs evaluados en Fase 1:
   solo agrega objetos NUEVOS de solo lectura (salvo la simulacion, que tampoco
   escribe). El registro real de movimientos sigue en SP_Inventario_RegistrarMovimiento
   (011) y los cambios de estado/devoluciones en 018. Convenciones: ver 020/024
   (NOCOUNT; sin SQL dinamico, filtros (@P IS NULL OR ...) + OPTION (RECOMPILE);
   montos DECIMAL(18,2); mensajes en espanol sin acentos; UTC via SYSUTCDATETIME()).

   Contenido:
     - SP_Inventario_ListarAdmin    : tabla de existencias por variante (chips bajoStock|
                                      agotadas|conReservas), con presentacion, ultimo
                                      movimiento e imagen. Recordsets: (1) pagina, (2) Total.
     - SP_Inventario_Resumen        : KPIs del tablero + desglose de movimientos de hoy.
     - SP_Inventario_SimularMovimiento: vista previa (solo lectura) de un movimiento con
                                      la MISMA regla que RegistrarMovimiento.
     - SP_Pedidos_ResumenOperacion  : conteos del flujo y antiguedad del PAGADO mas viejo.
     - SP_Pedidos_ListarOperacion   : listado de operacion con filtros (estado como lista
                                      separada por comas, texto, rango) y columnas de apoyo.

   Orden de ejecucion: 026 (al final, despues de 024). Ningun SP de 026 depende de
   objetos posteriores: solo de VW_Inventario_Disponible (008), Variante.ImagenURL (025),
   Kardex/TipoMovimientoInventario (001/004), Pedido/EstadoPedido/PedidoDetalle/Direccion/
   ProductoImagen (001) y los parametros STOCK_MINIMO/RESERVA_MINUTOS (004).
   Idempotente: CREATE OR ALTER. Requiere SQL Server 2022 (DATETRUNC, STRING_SPLIT,
   STRING_AGG).
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   SP_Inventario_ListarAdmin
   Una fila por variante (activa o inactiva). @Filtro acota a un subconjunto:
     'bajoStock'  -> Disponible entre 1 y STOCK_MINIMO
     'agotadas'   -> Disponible <= 0
     'conReservas'-> Reservado > 0
   Columnas: identidad de la variante, Presentacion (atributos con STRING_AGG),
   Existencia/Reservado/Disponible (VW_Inventario_Disponible), BajoStock, el ultimo
   movimiento (fecha/tipo/cantidad/signo) e imagen (propia de la variante y la resuelta
   con COALESCE a la principal del producto). Recordsets: (1) pagina, (2) Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_ListarAdmin
    @Texto       NVARCHAR(100) = NULL,
    @IDCategoria INT           = NULL,
    @Filtro      NVARCHAR(20)  = NULL,
    @Pagina      INT           = 1,
    @Tamano      INT           = 20,
    @IDProducto  INT           = NULL  -- acota a las variantes de un producto (boton "Inventario" de /admin/productos)
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @Tamano IS NULL OR @Tamano < 1 SET @Tamano = 20;
    IF @Tamano > 100 SET @Tamano = 100;

    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);
    DECLARE @Patron NVARCHAR(102) = CASE WHEN @Texto IS NULL THEN NULL ELSE CONCAT(N'%', @Texto, N'%') END;
    DECLARE @Offset INT = (@Pagina - 1) * @Tamano;

    SELECT
        v.IDVariante, v.SKU, v.IDProducto, p.Nombre AS Producto,
        p.IDCategoria, c.Nombre AS Categoria, v.Precio, v.Activo,
        pres.Presentacion,
        inv.Existencia, inv.Reservado, inv.Disponible,
        CAST(CASE WHEN inv.Disponible <= @StockMin THEN 1 ELSE 0 END AS BIT) AS BajoStock,
        um.UltimoMovimientoFecha, um.UltimoMovimientoTipo,
        um.UltimoMovimientoNombre, um.UltimoMovimientoCantidad, um.UltimoMovimientoSigno,
        v.ImagenURL,
        COALESCE(v.ImagenURL, img.Url) AS ImagenPrincipal
    INTO #Inv
    FROM dbo.Variante v
    INNER JOIN dbo.Producto p  ON p.IDProducto  = v.IDProducto
    INNER JOIN dbo.Categoria c ON c.IDCategoria = p.IDCategoria
    INNER JOIN dbo.VW_Inventario_Disponible inv ON inv.IDVariante = v.IDVariante
    OUTER APPLY (
        SELECT STRING_AGG(a.Valor, N' · ') WITHIN GROUP (ORDER BY a.Nombre) AS Presentacion
        FROM dbo.VarianteAtributo a
        WHERE a.IDVariante = v.IDVariante
    ) pres
    OUTER APPLY (
        SELECT TOP (1)
               k.Fecha        AS UltimoMovimientoFecha,
               t.Codigo       AS UltimoMovimientoTipo,
               t.Nombre       AS UltimoMovimientoNombre,
               k.Cantidad     AS UltimoMovimientoCantidad,
               t.Signo        AS UltimoMovimientoSigno
        FROM dbo.Kardex k
        INNER JOIN dbo.TipoMovimientoInventario t ON t.IDTipoMovimientoInventario = k.IDTipoMovimientoInventario
        WHERE k.IDVariante = v.IDVariante
        ORDER BY k.Fecha DESC, k.IDKardex DESC
    ) um
    OUTER APPLY (
        SELECT TOP (1) pi.Url FROM dbo.ProductoImagen pi
        WHERE pi.IDProducto = v.IDProducto
        ORDER BY pi.EsPrincipal DESC, pi.Orden ASC, pi.IDProductoImagen ASC
    ) img
    WHERE (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@IDProducto IS NULL OR v.IDProducto = @IDProducto)
      AND (@Patron IS NULL OR v.SKU LIKE @Patron OR p.Nombre LIKE @Patron)
      AND (@Filtro IS NULL
           OR (@Filtro = N'bajoStock'   AND inv.Disponible BETWEEN 1 AND @StockMin)
           OR (@Filtro = N'agotadas'    AND inv.Disponible <= 0)
           OR (@Filtro = N'conReservas' AND inv.Reservado > 0));

    SELECT
        IDVariante, SKU, IDProducto, Producto, IDCategoria, Categoria, Precio, Activo,
        Presentacion, Existencia, Reservado, Disponible, BajoStock,
        UltimoMovimientoFecha, UltimoMovimientoTipo, UltimoMovimientoNombre,
        UltimoMovimientoCantidad, UltimoMovimientoSigno, ImagenURL, ImagenPrincipal
    FROM #Inv
    ORDER BY Producto ASC, SKU ASC
    OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total FROM #Inv;

    DROP TABLE #Inv;
END
GO

/* ------------------------------------------------------------
   SP_Inventario_Resumen
   KPIs del tablero de inventario (una fila) + un recordset con el desglose de los
   movimientos de HOY (fecha UTC del dia) por tipo. Inconsistencias = variantes cuya
   Existencia difiere de SUM(Signo * Cantidad) del kardex (debe ser 0). UmbralBajoStock
   y ReservaMinutos salen de dbo.Parametro para que el front muestre el valor REAL.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_Resumen
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StockMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'STOCK_MINIMO') AS INT), 5);
    DECLARE @ReservaMin INT = ISNULL(TRY_CAST((SELECT Valor FROM dbo.Parametro WHERE Clave = N'RESERVA_MINUTOS') AS INT), 15);
    DECLARE @HoyInicio DATETIME2(0) = DATETRUNC(DAY, SYSUTCDATETIME());

    SELECT
        COUNT(1)                                                                    AS TotalVariantes,
        ISNULL(SUM(inv.Disponible), 0)                                              AS UnidadesDisponibles,
        ISNULL(SUM(inv.Reservado), 0)                                               AS UnidadesReservadas,
        SUM(CASE WHEN inv.Activo = 1 AND inv.Disponible BETWEEN 1 AND @StockMin THEN 1 ELSE 0 END) AS VariantesBajoStock,
        SUM(CASE WHEN inv.Activo = 1 AND inv.Disponible <= 0 THEN 1 ELSE 0 END)      AS VariantesAgotadas,
        SUM(CASE WHEN inv.Reservado > 0 THEN 1 ELSE 0 END)                           AS VariantesConReservas,
        (SELECT COUNT(1) FROM dbo.Kardex k WHERE k.Fecha >= @HoyInicio)             AS MovimientosHoy,
        (SELECT COUNT(1) FROM (
            SELECT v.IDVariante
            FROM dbo.Variante v
            OUTER APPLY (
                SELECT SUM(t.Signo * k.Cantidad) AS SumaKardex
                FROM dbo.Kardex k
                INNER JOIN dbo.TipoMovimientoInventario t ON t.IDTipoMovimientoInventario = k.IDTipoMovimientoInventario
                WHERE k.IDVariante = v.IDVariante
            ) s
            WHERE v.Existencia <> ISNULL(s.SumaKardex, 0)
         ) inc)                                                                      AS Inconsistencias,
        @StockMin                                                                   AS UmbralBajoStock,
        @ReservaMin                                                                 AS ReservaMinutos
    FROM dbo.VW_Inventario_Disponible inv;

    /* Desglose de los movimientos de hoy por tipo (solo tipos con al menos uno). */
    SELECT t.Codigo AS CodigoTipo, t.Nombre AS NombreTipo, t.Signo, COUNT(1) AS Cantidad
    FROM dbo.Kardex k
    INNER JOIN dbo.TipoMovimientoInventario t ON t.IDTipoMovimientoInventario = k.IDTipoMovimientoInventario
    WHERE k.Fecha >= @HoyInicio
    GROUP BY t.Codigo, t.Nombre, t.Signo
    ORDER BY Cantidad DESC, t.Codigo;
END
GO

/* ------------------------------------------------------------
   SP_Inventario_SimularMovimiento
   Vista previa (solo lectura) de un movimiento, con la MISMA regla que
   SP_Inventario_RegistrarMovimiento: un movimiento no puede dejar la existencia < 0 ni
   el disponible (existencia - reservas activas) < 0. No escribe nada. Devuelve una fila:
   ExistenciaActual, Reservado, Disponible, ExistenciaResultante, DisponibleResultante,
   Permitido (BIT) y Motivo (NULL si Permitido = 1). Solo acepta los tipos expuestos a la
   API (ENTRADA_COMPRA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO).
   Errores: 50400 tipo/cantidad invalidos; 50404 variante no encontrada.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_SimularMovimiento
    @IDVariante INT,
    @Tipo       NVARCHAR(30),
    @Cantidad   INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @Tipo NOT IN (N'ENTRADA_COMPRA', N'AJUSTE_POSITIVO', N'AJUSTE_NEGATIVO')
        THROW 50400, 'Tipo de movimiento invalido para simulacion', 1;
    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50400, 'La cantidad debe ser mayor a cero', 1;

    DECLARE @Signo SMALLINT = (SELECT Signo FROM dbo.TipoMovimientoInventario WHERE Codigo = @Tipo);
    DECLARE @Existencia INT, @Reservado INT, @Disponible INT;

    SELECT @Existencia = inv.Existencia, @Reservado = inv.Reservado, @Disponible = inv.Disponible
    FROM dbo.VW_Inventario_Disponible inv
    WHERE inv.IDVariante = @IDVariante;

    IF @Existencia IS NULL
        THROW 50404, 'Variante no encontrada', 1;

    DECLARE @Resultante INT = @Existencia + @Signo * @Cantidad;
    DECLARE @DispResultante INT = @Resultante - @Reservado;
    DECLARE @Permitido BIT = 1, @Motivo NVARCHAR(300) = NULL;

    IF @Resultante < 0
    BEGIN
        SET @Permitido = 0;
        SET @Motivo = CONCAT(N'Existencia insuficiente: actual ', @Existencia, N', solicitado ', @Cantidad);
    END
    ELSE IF @DispResultante < 0
    BEGIN
        SET @Permitido = 0;
        SET @Motivo = CONCAT(N'Dejaria el disponible en ', @DispResultante,
                             N' (hay ', @Reservado, N' reservadas); no puede quedar por debajo de 0');
    END

    SELECT
        @Existencia     AS ExistenciaActual,
        @Reservado      AS Reservado,
        @Disponible     AS Disponible,
        @Resultante     AS ExistenciaResultante,
        @DispResultante AS DisponibleResultante,
        @Permitido      AS Permitido,
        @Motivo         AS Motivo;
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_ResumenOperacion
   Una fila con el pulso del flujo de pedidos para el area interna:
     - Pagado / EnPreparacion / Despachado : conteo actual en ese estado.
     - EntregadoReciente : pedidos ENTREGADO en los ultimos 7 dias (por
       FechaActualizacion, que marca cuando entraron al estado terminal).
     - CanceladosRecientes / DevueltosRecientes : en los ultimos 7 dias (misma regla).
       Estos tres se cuentan con el MISMO criterio que lista SP_Pedidos_ListarOperacion
       con @RecienteDias = 7, para que tarjeta y tabla coincidan.
     - PorPreparar = Pagado + EnPreparacion (fuente unica del badge "Pedidos").
     - PagadoMasAntiguoMinutos : antiguedad del PAGADO mas viejo (NULL si no hay).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ResumenOperacion
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Hace7Dias DATETIME2(0) = DATEADD(DAY, -7, SYSUTCDATETIME());

    ;WITH P AS (
        SELECT p.IDEstadoPedido, ep.Codigo AS EstadoCodigo, p.FechaCreacion, p.FechaActualizacion
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    )
    SELECT
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'PAGADO'         THEN 1 ELSE 0 END), 0) AS Pagado,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'EN_PREPARACION' THEN 1 ELSE 0 END), 0) AS EnPreparacion,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'DESPACHADO'     THEN 1 ELSE 0 END), 0) AS Despachado,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'PAGADO' OR EstadoCodigo = N'EN_PREPARACION'
                        THEN 1 ELSE 0 END), 0)                                       AS PorPreparar,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'ENTREGADO'
                        AND ISNULL(FechaActualizacion, FechaCreacion) >= @Hace7Dias
                        THEN 1 ELSE 0 END), 0)                                       AS EntregadoReciente,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'CANCELADO'
                        AND ISNULL(FechaActualizacion, FechaCreacion) >= @Hace7Dias
                        THEN 1 ELSE 0 END), 0)                                       AS CanceladosRecientes,
        ISNULL(SUM(CASE WHEN EstadoCodigo = N'DEVUELTO'
                        AND ISNULL(FechaActualizacion, FechaCreacion) >= @Hace7Dias
                        THEN 1 ELSE 0 END), 0)                                       AS DevueltosRecientes,
        DATEDIFF(MINUTE,
                 (SELECT MIN(FechaCreacion) FROM P WHERE EstadoCodigo = N'PAGADO'),
                 SYSUTCDATETIME())                                                   AS PagadoMasAntiguoMinutos
    FROM P;
END
GO

/* ------------------------------------------------------------
   SP_Pedidos_ListarOperacion
   Listado de pedidos para el area interna (Operador/Administrador). A diferencia de
   SP_Pedidos_Listar (018, intacto), acepta el estado como LISTA separada por comas
   (STRING_SPLIT) y agrega columnas de apoyo que la tabla de operacion necesita:
   NombreCliente, correo, Municipio/Departamento (de la direccion asociada; el snapshot
   DireccionEntrega es un texto unico, por eso el municipio se toma de dbo.Direccion via
   IDDireccion y es NULL si la direccion ya no existe), CantidadLineas/Unidades y
   MinutosEnEstado (minutos desde que el pedido entro a su estado actual). Conserva
   IDPedido y EstadoCodigo. @Texto busca por NumeroPedido, nombre o correo del cliente.
   @RecienteDias (NULL = sin ventana): acota a los pedidos cuya ULTIMA actualizacion
   (ISNULL(FechaActualizacion, FechaCreacion)) cae en los ultimos N dias; es el criterio
   de "recientes" para estados terminales (ENTREGADO, CANCELADO, DEVUELTO) y hace que la
   tabla coincida con los conteos de SP_Pedidos_ResumenOperacion (que usa 7 dias).
   Recordsets: (1) pagina, (2) Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarOperacion
    @CodigoEstado NVARCHAR(200) = NULL,
    @Texto        NVARCHAR(100) = NULL,
    @Desde        DATETIME2(0)  = NULL,
    @Hasta        DATETIME2(0)  = NULL,
    @IDUsuario    INT           = NULL,
    @Pagina       INT           = 1,
    @TamanoPagina INT           = 20,
    @RecienteDias INT           = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL OR @TamanoPagina < 1 SET @TamanoPagina = 20;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    DECLARE @Patron NVARCHAR(102) = CASE WHEN @Texto IS NULL THEN NULL ELSE CONCAT(N'%', @Texto, N'%') END;
    DECLARE @DesdeReciente DATETIME2(0) =
        CASE WHEN @RecienteDias IS NULL OR @RecienteDias < 1 THEN NULL
             ELSE DATEADD(DAY, -@RecienteDias, SYSUTCDATETIME()) END;

    ;WITH Filtrados AS (
        SELECT
            p.IDPedido, p.NumeroPedido, p.IDUsuario,
            u.Nombre AS NombreCliente, u.Correo AS ClienteCorreo,
            ep.Codigo AS EstadoCodigo, ep.Nombre AS EstadoNombre,
            p.Total, p.IDDireccion, dir.Municipio, dir.Departamento,
            p.FechaCreacion, p.FechaActualizacion,
            ln.CantidadLineas, ln.CantidadUnidades,
            DATEDIFF(MINUTE,
                     COALESCE(hst.FechaEstado, p.FechaCreacion),
                     SYSUTCDATETIME()) AS MinutosEnEstado
        FROM dbo.Pedido p
        INNER JOIN dbo.Usuario u       ON u.IDUsuario = p.IDUsuario
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        LEFT JOIN  dbo.Direccion dir   ON dir.IDDireccion = p.IDDireccion
        CROSS APPLY (
            SELECT COUNT(1) AS CantidadLineas, ISNULL(SUM(pd.Cantidad), 0) AS CantidadUnidades
            FROM dbo.PedidoDetalle pd WHERE pd.IDPedido = p.IDPedido
        ) ln
        OUTER APPLY (
            SELECT MAX(h.Fecha) AS FechaEstado
            FROM dbo.PedidoHistorialEstado h
            WHERE h.IDPedido = p.IDPedido AND h.IDEstadoNuevo = p.IDEstadoPedido
        ) hst
        WHERE (@IDUsuario IS NULL OR p.IDUsuario = @IDUsuario)
          AND (@CodigoEstado IS NULL
               OR ep.Codigo IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@CodigoEstado, N',')))
          AND (@Desde  IS NULL OR p.FechaCreacion >= @Desde)
          AND (@Hasta  IS NULL OR p.FechaCreacion < @Hasta)
          AND (@DesdeReciente IS NULL OR ISNULL(p.FechaActualizacion, p.FechaCreacion) >= @DesdeReciente)
          AND (@Patron IS NULL OR p.NumeroPedido LIKE @Patron OR u.Nombre LIKE @Patron OR u.Correo LIKE @Patron)
    )
    SELECT *
    FROM Filtrados
    ORDER BY FechaCreacion DESC, IDPedido DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS
    FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Pedido p
    INNER JOIN dbo.Usuario u       ON u.IDUsuario = p.IDUsuario
    INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    WHERE (@IDUsuario IS NULL OR p.IDUsuario = @IDUsuario)
      AND (@CodigoEstado IS NULL
           OR ep.Codigo IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@CodigoEstado, N',')))
      AND (@Desde  IS NULL OR p.FechaCreacion >= @Desde)
      AND (@Hasta  IS NULL OR p.FechaCreacion < @Hasta)
      AND (@DesdeReciente IS NULL OR ISNULL(p.FechaActualizacion, p.FechaCreacion) >= @DesdeReciente)
      AND (@Patron IS NULL OR p.NumeroPedido LIKE @Patron OR u.Nombre LIKE @Patron OR u.Correo LIKE @Patron)
    OPTION (RECOMPILE);
END
GO
