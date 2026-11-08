/* ============================================================
   027_SP_Fase2_Control.sql
   ShopCart - Fase 2 (F8): area interna de control (Cupones, Bitacora, Usuarios).

   Todo ADITIVO: no cambia firmas ni comportamiento de los SP evaluados en Fase 1.
     - Cupones  (M5): SP_Cupones_Crear/Actualizar/CambiarEstado quedan intactos. Aqui
                      solo se AGREGAN SP_Cupones_ListarAdmin y SP_Cupones_ResumenAdmin
                      (listado y KPIs del panel de administracion).
     - Bitacora (M8): SP_Bitacora_Consultar se re-crea (CREATE OR ALTER) AGREGANDO al
                      final el parametro @Texto (LIKE sobre ValorAnterior/ValorNuevo); el
                      resto de parametros y la forma de los recordsets no cambian. El
                      parametro @IDEntidad de M8 ES el "IDRegistro" del requisito (no se
                      duplica). Se AGREGA SP_Bitacora_ListarPorRegistro.
     - Usuarios (M1): SP_Usuarios_Crear/CambiarRol/CambiarEstado quedan intactos (la
                      proteccion "no cambiar el propio rol/estado" ya existe, con 50409).
                      Aqui se AGREGAN SP_Usuarios_ListarAdmin (con pedidos/bloqueo) y
                      SP_Usuarios_Desbloquear.

   Convenciones: ver 005/006/019 (NOCOUNT; XACT_ABORT en escrituras; session context con
   @IDUsuarioEjecuta; errores 50400-50499; mensajes sin acentos; sin SQL dinamico; sin
   cursores; montos DECIMAL(18,2); OPTION (RECOMPILE) en los listados con filtros opcionales).

   "Ultimo acceso" NO existe en el modelo (dbo.Usuario no lo almacena): no se inventa.

   Orden de ejecucion F8: 027 (despues de 026). Idempotente: CREATE OR ALTER.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   CUPONES (Administrador)
   ============================================================ */

/* ------------------------------------------------------------
   SP_Cupones_ListarAdmin
   Listado paginado con el estado derivado del cupon y su alcance.
   Parametros:
     @Texto   LIKE sobre Codigo.
     @Filtro  NULL (todos) o uno de: 'vigentes' | 'futuros' | 'vencidos' |
              'agotados' | 'inactivos' (coincide con EstadoDerivado).
     @Pagina, @Tamano  acotado 1-100.
   EstadoDerivado (en orden de precedencia):
     Inactivo (Activo=0) > Agotado (limite total alcanzado) > Vencido (FechaFin < ahora)
     > Programado (FechaInicio > ahora) > Vigente.
   Devuelve: recordset 1 = pagina (incluye Alcance y DiasParaVencer); recordset 2 = Total.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_ListarAdmin
    @Texto     NVARCHAR(50) = NULL,
    @Filtro    NVARCHAR(20) = NULL,
    @Pagina    INT          = 1,
    @Tamano    INT          = 20,
    @Orden     NVARCHAR(40) = NULL,
    @Direccion NVARCHAR(4)  = N'DESC'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @Tamano IS NULL SET @Tamano = 20;
    IF @Tamano < 1 SET @Tamano = 1;
    IF @Tamano > 100 SET @Tamano = 100;

    -- Ordenamiento del lado del servidor por lista blanca (sin SQL dinamico); fuera de lista -> 50422.
    DECLARE @Dir NVARCHAR(4) = CASE WHEN UPPER(@Direccion) = N'ASC' THEN N'ASC' ELSE N'DESC' END;
    DECLARE @Ord NVARCHAR(40) = LOWER(ISNULL(@Orden, N'vigencia'));
    IF @Ord NOT IN (N'codigo', N'vigencia', N'usos')
        THROW 50422, 'Columna de ordenamiento invalida', 1;

    DECLARE @Patron NVARCHAR(320) = CASE WHEN @Texto IS NULL THEN NULL
        ELSE CONCAT(N'%', REPLACE(REPLACE(REPLACE(@Texto, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]'), N'%') END;
    DECLARE @Offset INT = (@Pagina - 1) * @Tamano;
    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();

    SELECT
        c.IDCupon, c.Codigo, c.TipoDescuento AS Tipo, c.Valor, c.MontoMinimo,
        c.IDCategoria,
        ISNULL(cat.Nombre, N'Todo el carrito') AS Alcance,
        c.FechaInicio, c.FechaFin,
        c.LimiteUsosTotal AS LimiteUsos, c.LimiteUsosPorCliente AS LimitePorCliente,
        c.UsosActuales, c.Activo,
        CAST(DATEDIFF(DAY, @Ahora, c.FechaFin) AS INT) AS DiasParaVencer,
        CASE
            WHEN c.Activo = 0 THEN N'Inactivo'
            WHEN c.LimiteUsosTotal IS NOT NULL AND c.UsosActuales >= c.LimiteUsosTotal THEN N'Agotado'
            WHEN c.FechaFin   < @Ahora THEN N'Vencido'
            WHEN c.FechaInicio > @Ahora THEN N'Programado'
            ELSE N'Vigente'
        END AS EstadoDerivado
    INTO #CuponesAdmin
    FROM dbo.Cupon c
    LEFT JOIN dbo.Categoria cat ON cat.IDCategoria = c.IDCategoria
    WHERE (@Patron IS NULL OR c.Codigo LIKE @Patron);

    SELECT IDCupon, Codigo, Tipo, Valor, MontoMinimo, IDCategoria, Alcance,
           FechaInicio, FechaFin, LimiteUsos, LimitePorCliente, UsosActuales, Activo,
           DiasParaVencer, EstadoDerivado
    FROM #CuponesAdmin
    WHERE (@Filtro IS NULL
           OR (@Filtro = N'vigentes'  AND EstadoDerivado = N'Vigente')
           OR (@Filtro = N'futuros'   AND EstadoDerivado = N'Programado')
           OR (@Filtro = N'vencidos'  AND EstadoDerivado = N'Vencido')
           OR (@Filtro = N'agotados'  AND EstadoDerivado = N'Agotado')
           OR (@Filtro = N'inactivos' AND EstadoDerivado = N'Inactivo'))
    ORDER BY
        CASE WHEN @Ord = N'codigo'   AND @Dir = N'ASC'  THEN Codigo END ASC,
        CASE WHEN @Ord = N'codigo'   AND @Dir = N'DESC' THEN Codigo END DESC,
        CASE WHEN @Ord = N'vigencia' AND @Dir = N'ASC'  THEN FechaFin END ASC,
        CASE WHEN @Ord = N'vigencia' AND @Dir = N'DESC' THEN FechaFin END DESC,
        CASE WHEN @Ord = N'usos'     AND @Dir = N'ASC'  THEN UsosActuales END ASC,
        CASE WHEN @Ord = N'usos'     AND @Dir = N'DESC' THEN UsosActuales END DESC,
        IDCupon DESC
    OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM #CuponesAdmin
    WHERE (@Filtro IS NULL
           OR (@Filtro = N'vigentes'  AND EstadoDerivado = N'Vigente')
           OR (@Filtro = N'futuros'   AND EstadoDerivado = N'Programado')
           OR (@Filtro = N'vencidos'  AND EstadoDerivado = N'Vencido')
           OR (@Filtro = N'agotados'  AND EstadoDerivado = N'Agotado')
           OR (@Filtro = N'inactivos' AND EstadoDerivado = N'Inactivo'))
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Cupones_ResumenAdmin
   KPIs del panel. Una sola fila. "No cancelados" = EstadoPedido.Codigo <> 'CANCELADO'.
   Ventana de 30 dias por Pedido.FechaCreacion. El cupon mas usado sale de CuponUso
   (usos reales); su beneficio = SUM(Pedido.Descuento) de sus pedidos no cancelados.
   Los conteos por estado derivado usan la misma precedencia que SP_Cupones_ListarAdmin.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_ResumenAdmin
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @Hace30 DATETIME2(0) = DATEADD(DAY, -30, @Ahora);
    DECLARE @Hasta7 DATETIME2(0) = DATEADD(DAY, 7, @Ahora);

    /* Estado derivado de cada cupon (para los conteos por estado). */
    DECLARE @Vigentes INT, @Programados INT, @Vencidos INT, @Agotados INT, @Inactivos INT, @Total INT;

    SELECT
        @Total       = COUNT(1),
        @Inactivos   = SUM(CASE WHEN Activo = 0 THEN 1 ELSE 0 END),
        @Agotados    = SUM(CASE WHEN Activo = 1 AND LimiteUsosTotal IS NOT NULL AND UsosActuales >= LimiteUsosTotal THEN 1 ELSE 0 END),
        @Vencidos    = SUM(CASE WHEN Activo = 1 AND NOT (LimiteUsosTotal IS NOT NULL AND UsosActuales >= LimiteUsosTotal)
                                     AND FechaFin < @Ahora THEN 1 ELSE 0 END),
        @Programados = SUM(CASE WHEN Activo = 1 AND NOT (LimiteUsosTotal IS NOT NULL AND UsosActuales >= LimiteUsosTotal)
                                     AND FechaFin >= @Ahora AND FechaInicio > @Ahora THEN 1 ELSE 0 END),
        @Vigentes    = SUM(CASE WHEN Activo = 1 AND NOT (LimiteUsosTotal IS NOT NULL AND UsosActuales >= LimiteUsosTotal)
                                     AND FechaFin >= @Ahora AND FechaInicio <= @Ahora THEN 1 ELSE 0 END)
    FROM dbo.Cupon;

    /* Ventana de 30 dias sobre pedidos no cancelados. */
    DECLARE @DescuentoOtorgado30d DECIMAL(18,2), @PedidosConCupon30d INT, @Pedidos30d INT;

    SELECT
        @DescuentoOtorgado30d = CAST(ISNULL(SUM(p.Descuento), 0) AS DECIMAL(18,2)),
        @Pedidos30d           = COUNT(1),
        @PedidosConCupon30d   = SUM(CASE WHEN p.IDCupon IS NOT NULL THEN 1 ELSE 0 END)
    FROM dbo.Pedido p
    INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
    WHERE ep.Codigo <> N'CANCELADO'
      AND p.FechaCreacion >= @Hace30;

    SELECT
        @DescuentoOtorgado30d AS DescuentoOtorgado30d,
        ISNULL(@PedidosConCupon30d, 0) AS PedidosConCupon30d,
        ISNULL(@Pedidos30d, 0) AS Pedidos30d,
        CAST(CASE WHEN ISNULL(@Pedidos30d, 0) = 0 THEN 0
                  ELSE ROUND(@PedidosConCupon30d * 100.0 / @Pedidos30d, 1) END AS DECIMAL(5,1)) AS TasaUso,
        mu.Codigo    AS CuponMasUsadoCodigo,
        mu.Usos      AS CuponMasUsadoUsos,
        mu.Beneficio AS CuponMasUsadoBeneficio,
        (SELECT COUNT(1) FROM dbo.Cupon c
          WHERE c.Activo = 1
            AND NOT (c.LimiteUsosTotal IS NOT NULL AND c.UsosActuales >= c.LimiteUsosTotal)
            AND c.FechaInicio <= @Ahora AND c.FechaFin >= @Ahora AND c.FechaFin <= @Hasta7) AS CuponesPorVencer7d,
        pv.Codigo   AS CuponPorVencerCodigo,
        pv.FechaFin AS CuponPorVencerFecha,
        @Total AS Total, @Vigentes AS Vigentes, @Programados AS Programados,
        @Vencidos AS Vencidos, @Agotados AS Agotados, @Inactivos AS Inactivos
    FROM (SELECT 1 AS x) z
    OUTER APPLY (
        SELECT TOP (1) c.Codigo,
               COUNT(u.IDCuponUso) AS Usos,
               CAST(ISNULL(SUM(CASE WHEN ep.Codigo <> N'CANCELADO' THEN p.Descuento ELSE 0 END), 0) AS DECIMAL(18,2)) AS Beneficio
        FROM dbo.CuponUso u
        INNER JOIN dbo.Cupon c ON c.IDCupon = u.IDCupon
        INNER JOIN dbo.Pedido p ON p.IDPedido = u.IDPedido
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        GROUP BY c.IDCupon, c.Codigo
        ORDER BY COUNT(u.IDCuponUso) DESC, c.Codigo
    ) mu
    OUTER APPLY (
        SELECT TOP (1) c.Codigo, c.FechaFin
        FROM dbo.Cupon c
        WHERE c.Activo = 1
          AND NOT (c.LimiteUsosTotal IS NOT NULL AND c.UsosActuales >= c.LimiteUsosTotal)
          AND c.FechaInicio <= @Ahora AND c.FechaFin >= @Ahora AND c.FechaFin <= @Hasta7
        ORDER BY c.FechaFin ASC, c.Codigo
    ) pv;
END
GO

/* ============================================================
   BITACORA (Administrador)
   ============================================================ */

/* ------------------------------------------------------------
   SP_Bitacora_Consultar  (CREATE OR ALTER - aditivo)
   Igual que 019 pero con @Texto NVARCHAR(100) = NULL al final: LIKE sobre
   ValorAnterior/ValorNuevo. @IDEntidad es el IDRegistro del requisito. El resto de
   parametros y la forma de los dos recordsets no cambian.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_Consultar
    @Modulo       NVARCHAR(50)  = NULL,
    @Entidad      NVARCHAR(100) = NULL,
    @IDEntidad    INT           = NULL,
    @IDUsuario    INT           = NULL,
    @Accion       NVARCHAR(20)  = NULL,
    @Desde        DATETIME2(0)  = NULL,
    @Hasta        DATETIME2(0)  = NULL,
    @Pagina       INT           = 1,
    @TamanoPagina INT           = 20,
    @Texto        NVARCHAR(100) = NULL,
    @Orden        NVARCHAR(40)  = NULL,
    @Direccion    NVARCHAR(4)   = N'DESC'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina IS NULL SET @TamanoPagina = 20;
    IF @TamanoPagina < 1 SET @TamanoPagina = 1;
    IF @TamanoPagina > 100 SET @TamanoPagina = 100;

    -- Ordenamiento del lado del servidor por lista blanca (solo por fecha); fuera de lista -> 50422.
    DECLARE @Dir NVARCHAR(4) = CASE WHEN UPPER(@Direccion) = N'ASC' THEN N'ASC' ELSE N'DESC' END;
    DECLARE @Ord NVARCHAR(40) = LOWER(ISNULL(@Orden, N'fecha'));
    IF @Ord NOT IN (N'fecha')
        THROW 50422, 'Columna de ordenamiento invalida', 1;

    DECLARE @Offset INT = (@Pagina - 1) * @TamanoPagina;
    DECLARE @Patron NVARCHAR(320) = CASE WHEN @Texto IS NULL THEN NULL
        ELSE CONCAT(N'%', REPLACE(REPLACE(REPLACE(@Texto, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]'), N'%') END;

    SELECT b.IDBitacora, b.Modulo, b.Entidad, b.IDEntidad, b.Accion,
           b.ValorAnterior, b.ValorNuevo,
           b.IDUsuario, u.Correo AS UsuarioCorreo, u.Nombre AS UsuarioNombre,
           b.Fecha
    FROM dbo.Bitacora b
    LEFT JOIN dbo.Usuario u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo    IS NULL OR b.Modulo    = @Modulo)
      AND (@Entidad   IS NULL OR b.Entidad   = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@Accion    IS NULL OR b.Accion    = @Accion)
      AND (@Desde     IS NULL OR b.Fecha    >= @Desde)
      AND (@Hasta     IS NULL OR b.Fecha    <= @Hasta)
      AND (@Patron    IS NULL OR b.ValorAnterior LIKE @Patron OR b.ValorNuevo LIKE @Patron)
    ORDER BY
        CASE WHEN @Dir = N'ASC'  THEN b.Fecha END ASC,
        CASE WHEN @Dir = N'DESC' THEN b.Fecha END DESC,
        b.IDBitacora DESC
    OFFSET @Offset ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total
    FROM dbo.Bitacora b
    WHERE (@Modulo    IS NULL OR b.Modulo    = @Modulo)
      AND (@Entidad   IS NULL OR b.Entidad   = @Entidad)
      AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@IDUsuario IS NULL OR b.IDUsuario = @IDUsuario)
      AND (@Accion    IS NULL OR b.Accion    = @Accion)
      AND (@Desde     IS NULL OR b.Fecha    >= @Desde)
      AND (@Hasta     IS NULL OR b.Fecha    <= @Hasta)
      AND (@Patron    IS NULL OR b.ValorAnterior LIKE @Patron OR b.ValorNuevo LIKE @Patron)
    OPTION (RECOMPILE);
END
GO

/* ------------------------------------------------------------
   SP_Bitacora_ListarPorRegistro  (Administrador)
   Todos los eventos de un registro (Entidad = @Tabla, IDEntidad = @IDRegistro),
   mas reciente primero. Solo lectura. Mismas columnas que SP_Bitacora_Consultar.
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Bitacora_ListarPorRegistro
    @Tabla      NVARCHAR(100),
    @IDRegistro INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT b.IDBitacora, b.Modulo, b.Entidad, b.IDEntidad, b.Accion,
           b.ValorAnterior, b.ValorNuevo,
           b.IDUsuario, u.Correo AS UsuarioCorreo, u.Nombre AS UsuarioNombre,
           b.Fecha
    FROM dbo.Bitacora b
    LEFT JOIN dbo.Usuario u ON u.IDUsuario = b.IDUsuario
    WHERE b.Entidad = @Tabla AND b.IDEntidad = @IDRegistro
    ORDER BY b.Fecha DESC, b.IDBitacora DESC
    OPTION (RECOMPILE);
END
GO

/* ============================================================
   USUARIOS (Administrador)
   ============================================================ */

/* ------------------------------------------------------------
   SP_Usuarios_ListarAdmin
   Listado paginado con pedidos del cliente y estado de bloqueo.
   Parametros:
     @Texto   LIKE sobre Nombre/Correo.
     @IDRol   filtra por rol.
     @Filtro  NULL o 'bloqueados' (BloqueadoHasta > ahora) | 'desactivados' (Activo=0).
     @Pagina, @Tamano  acotado 1-100.
   CantidadPedidos/TotalComprado: pedidos no cancelados del usuario (0 para internos).
   MinutosBloqueo: minutos restantes de bloqueo (NULL si no esta bloqueado).
   Devuelve: (1) pagina; (2) Total; (3) conteos por rol/estado (sobre toda la tabla).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_ListarAdmin
    @Texto     NVARCHAR(100) = NULL,
    @IDRol     INT           = NULL,
    @Filtro    NVARCHAR(20)  = NULL,
    @Pagina    INT           = 1,
    @Tamano    INT           = 20,
    @Orden     NVARCHAR(40)  = NULL,
    @Direccion NVARCHAR(4)   = N'ASC'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina IS NULL OR @Pagina < 1 SET @Pagina = 1;
    IF @Tamano IS NULL SET @Tamano = 20;
    IF @Tamano < 1 SET @Tamano = 1;
    IF @Tamano > 100 SET @Tamano = 100;

    -- Ordenamiento del lado del servidor por lista blanca (sin SQL dinamico); fuera de lista -> 50422.
    DECLARE @Dir NVARCHAR(4) = CASE WHEN UPPER(@Direccion) = N'DESC' THEN N'DESC' ELSE N'ASC' END;
    DECLARE @Ord NVARCHAR(40) = LOWER(ISNULL(@Orden, N'nombre'));
    IF @Ord NOT IN (N'nombre', N'correo', N'rol')
        THROW 50422, 'Columna de ordenamiento invalida', 1;

    DECLARE @Patron NVARCHAR(320) = CASE WHEN @Texto IS NULL THEN NULL
        ELSE CONCAT(N'%', REPLACE(REPLACE(REPLACE(@Texto, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]'), N'%') END;
    DECLARE @Offset INT = (@Pagina - 1) * @Tamano;
    DECLARE @Ahora DATETIME2(0) = SYSUTCDATETIME();

    /* Agregado de pedidos no cancelados por usuario (solo clientes tienen pedidos). */
    ;WITH Ped AS (
        SELECT p.IDUsuario,
               COUNT(1) AS CantidadPedidos,
               CAST(SUM(p.Total) AS DECIMAL(18,2)) AS TotalComprado
        FROM dbo.Pedido p
        INNER JOIN dbo.EstadoPedido ep ON ep.IDEstadoPedido = p.IDEstadoPedido
        WHERE ep.Codigo <> N'CANCELADO'
        GROUP BY p.IDUsuario
    )
    SELECT u.IDUsuario, u.Nombre, u.Correo, u.IDRol, r.Nombre AS Rol, u.Activo,
           u.IntentosFallidos, u.BloqueadoHasta,
           CASE WHEN u.BloqueadoHasta IS NOT NULL AND u.BloqueadoHasta > @Ahora
                THEN DATEDIFF(MINUTE, @Ahora, u.BloqueadoHasta) ELSE NULL END AS MinutosBloqueo,
           u.FechaCreacion,
           ISNULL(pd.CantidadPedidos, 0) AS CantidadPedidos,
           CAST(ISNULL(pd.TotalComprado, 0) AS DECIMAL(18,2)) AS TotalComprado
    INTO #UsuariosAdmin
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    LEFT JOIN Ped pd ON pd.IDUsuario = u.IDUsuario
    WHERE (@Patron IS NULL OR u.Nombre LIKE @Patron OR u.Correo LIKE @Patron)
      AND (@IDRol  IS NULL OR u.IDRol = @IDRol)
      AND (@Filtro IS NULL
           OR (@Filtro = N'bloqueados'   AND u.BloqueadoHasta IS NOT NULL AND u.BloqueadoHasta > @Ahora)
           OR (@Filtro = N'desactivados' AND u.Activo = 0));

    SELECT IDUsuario, Nombre, Correo, IDRol, Rol, Activo, IntentosFallidos, BloqueadoHasta,
           MinutosBloqueo, FechaCreacion, CantidadPedidos, TotalComprado
    FROM #UsuariosAdmin
    ORDER BY
        CASE WHEN @Ord = N'nombre' AND @Dir = N'ASC'  THEN Nombre END ASC,
        CASE WHEN @Ord = N'nombre' AND @Dir = N'DESC' THEN Nombre END DESC,
        CASE WHEN @Ord = N'correo' AND @Dir = N'ASC'  THEN Correo END ASC,
        CASE WHEN @Ord = N'correo' AND @Dir = N'DESC' THEN Correo END DESC,
        CASE WHEN @Ord = N'rol'    AND @Dir = N'ASC'  THEN Rol END ASC,
        CASE WHEN @Ord = N'rol'    AND @Dir = N'DESC' THEN Rol END DESC,
        IDUsuario ASC
    OFFSET @Offset ROWS FETCH NEXT @Tamano ROWS ONLY
    OPTION (RECOMPILE);

    SELECT COUNT(1) AS Total FROM #UsuariosAdmin;

    /* Conteos globales (no filtrados) para los chips y el subtitulo. */
    SELECT
        COUNT(1) AS Total,
        SUM(CASE WHEN r.Nombre = N'Administrador' THEN 1 ELSE 0 END) AS Administradores,
        SUM(CASE WHEN r.Nombre = N'Operador'      THEN 1 ELSE 0 END) AS Operadores,
        SUM(CASE WHEN r.Nombre = N'Cliente'       THEN 1 ELSE 0 END) AS Clientes,
        SUM(CASE WHEN u.BloqueadoHasta IS NOT NULL AND u.BloqueadoHasta > @Ahora THEN 1 ELSE 0 END) AS Bloqueados,
        SUM(CASE WHEN u.Activo = 0 THEN 1 ELSE 0 END) AS Desactivados
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol;
END
GO

/* ------------------------------------------------------------
   SP_Usuarios_Desbloquear
   Limpia el bloqueo: IntentosFallidos = 0 y BloqueadoHasta = NULL.
   Parametros: @IDUsuario, @IDUsuarioEjecuta.
   Errores: 50404 usuario no existe. (dbo.Usuario no se audita: no toca Bitacora.)
   Devuelve: el usuario actualizado (misma forma que SP_Usuarios_CambiarEstado).
   ------------------------------------------------------------ */
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Desbloquear
    @IDUsuario        INT,
    @IDUsuarioEjecuta INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;

    IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IDUsuario = @IDUsuario)
        THROW 50404, 'Usuario no encontrado', 1;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE dbo.Usuario
           SET IntentosFallidos = 0,
               BloqueadoHasta   = NULL,
               FechaActualizacion = SYSUTCDATETIME()
         WHERE IDUsuario = @IDUsuario;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Activo, u.IDRol, r.Nombre AS Rol,
           u.IntentosFallidos, u.BloqueadoHasta, u.FechaCreacion, u.FechaActualizacion
    FROM dbo.Usuario u
    INNER JOIN dbo.Rol r ON r.IDRol = u.IDRol
    WHERE u.IDUsuario = @IDUsuario;
END
GO
