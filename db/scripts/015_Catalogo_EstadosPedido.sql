/* ============================================================
   015_Catalogo_EstadosPedido.sql
   ShopCart - Estados de pedido y transiciones permitidas (RF-06, base de RF-07).

   Siembra el catalogo dbo.EstadoPedido y el grafo de transiciones
   dbo.TransicionEstadoPedido que gobierna el ciclo de vida del pedido:

       PAGADO -> EN_PREPARACION -> DESPACHADO -> ENTREGADO -> DEVUELTO
          |            |
          +-----> CANCELADO <----+

   IDRolRequerido indica el rol minimo que la API exige para disparar la
   transicion (por nombre de rol). NULL = cualquier rol autorizado por la API
   (cliente dueno u operador). El Administrador hereda lo del Operador en la
   capa de API (M7); aqui solo se guarda el rol base.

   Orden de ejecucion M6: 004 (reaplicar) -> 015 -> 016 -> 099 (si cambio).
   Idempotente: EstadoPedido por Codigo; TransicionEstadoPedido por par
   origen/destino. Reaplicable sin error.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   Estados (en orden del ciclo de vida). EsFinal = 1 en estados terminales.
   ------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = N'PAGADO')
    INSERT dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
    VALUES (N'PAGADO', N'Pagado', 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = N'EN_PREPARACION')
    INSERT dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
    VALUES (N'EN_PREPARACION', N'En preparacion', 0, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = N'DESPACHADO')
    INSERT dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
    VALUES (N'DESPACHADO', N'Despachado', 0, 3);

IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = N'ENTREGADO')
    INSERT dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
    VALUES (N'ENTREGADO', N'Entregado', 0, 4);

IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = N'CANCELADO')
    INSERT dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
    VALUES (N'CANCELADO', N'Cancelado', 1, 5);

IF NOT EXISTS (SELECT 1 FROM dbo.EstadoPedido WHERE Codigo = N'DEVUELTO')
    INSERT dbo.EstadoPedido (Codigo, Nombre, EsFinal, Orden)
    VALUES (N'DEVUELTO', N'Devuelto', 1, 6);
GO

/* ------------------------------------------------------------
   Transiciones permitidas. Se insertan por codigo de estado y nombre de rol,
   solo si el par origen/destino no existe aun.
   ------------------------------------------------------------ */
INSERT dbo.TransicionEstadoPedido (IDEstadoOrigen, IDEstadoDestino, IDRolRequerido)
SELECT origen.IDEstadoPedido, destino.IDEstadoPedido, rol.IDRol
FROM (VALUES
        (N'PAGADO',         N'EN_PREPARACION', N'Operador'),
        (N'EN_PREPARACION', N'DESPACHADO',     N'Operador'),
        (N'DESPACHADO',     N'ENTREGADO',      N'Operador'),
        (N'PAGADO',         N'CANCELADO',      NULL),
        (N'EN_PREPARACION', N'CANCELADO',      NULL),
        (N'ENTREGADO',      N'DEVUELTO',       N'Operador')
     ) AS t (CodigoOrigen, CodigoDestino, NombreRol)
INNER JOIN dbo.EstadoPedido origen  ON origen.Codigo  = t.CodigoOrigen
INNER JOIN dbo.EstadoPedido destino ON destino.Codigo = t.CodigoDestino
LEFT JOIN  dbo.Rol          rol     ON rol.Nombre     = t.NombreRol
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.TransicionEstadoPedido x
    WHERE x.IDEstadoOrigen  = origen.IDEstadoPedido
      AND x.IDEstadoDestino = destino.IDEstadoPedido
);
GO
