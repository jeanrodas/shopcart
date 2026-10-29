/* ============================================================
   001_CreateDatabase.sql
   ShopCart - Base de datos y modelo relacional
   SQL Server 2019+. Ejecutar sobre instancia limpia.
   Convenciones: tablas en singular PascalCase, PK IDNombre,
   montos DECIMAL(18,2), fechas DATETIME2(0) en UTC.
   ============================================================ */

IF DB_ID(N'ShopCart') IS NULL
BEGIN
    CREATE DATABASE ShopCart;
END
GO

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ------------------------------------------------------------
   Secuencia para número de pedido legible (SC-000001)
   ------------------------------------------------------------ */
CREATE SEQUENCE dbo.SEQ_Pedido_Numero
    AS INT
    START WITH 1
    INCREMENT BY 1
    NO CYCLE;
GO

/* ------------------------------------------------------------
   Parámetros de configuración leídos por SPs
   ------------------------------------------------------------ */
CREATE TABLE dbo.Parametro (
    Clave        NVARCHAR(50)   NOT NULL,
    Valor        NVARCHAR(200)  NOT NULL,
    Descripcion  NVARCHAR(300)  NOT NULL,
    CONSTRAINT PK_Parametro PRIMARY KEY CLUSTERED (Clave)
);
GO

/* ------------------------------------------------------------
   Seguridad y usuarios (RF-01)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Rol (
    IDRol        INT IDENTITY(1,1) NOT NULL,
    Nombre       NVARCHAR(30)      NOT NULL,
    Descripcion  NVARCHAR(200)     NOT NULL,
    CONSTRAINT PK_Rol PRIMARY KEY CLUSTERED (IDRol),
    CONSTRAINT UQ_Rol_Nombre UNIQUE (Nombre)
);
GO

CREATE TABLE dbo.Usuario (
    IDUsuario            INT IDENTITY(1,1) NOT NULL,
    IDRol                INT               NOT NULL,
    Correo               NVARCHAR(255)     NOT NULL,
    HashContrasena       NVARCHAR(255)     NOT NULL,
    Nombre               NVARCHAR(150)     NOT NULL,
    Activo               BIT               NOT NULL CONSTRAINT DF_Usuario_Activo DEFAULT (1),
    IntentosFallidos     INT               NOT NULL CONSTRAINT DF_Usuario_IntentosFallidos DEFAULT (0),
    BloqueadoHasta       DATETIME2(0)      NULL,
    FechaCreacion        DATETIME2(0)      NOT NULL CONSTRAINT DF_Usuario_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion   DATETIME2(0)      NULL,
    CONSTRAINT PK_Usuario PRIMARY KEY CLUSTERED (IDUsuario),
    CONSTRAINT UQ_Usuario_Correo UNIQUE (Correo),
    CONSTRAINT FK_Usuario_Rol FOREIGN KEY (IDRol) REFERENCES dbo.Rol (IDRol),
    CONSTRAINT CK_Usuario_Correo CHECK (Correo LIKE N'%_@_%._%'),
    CONSTRAINT CK_Usuario_IntentosFallidos CHECK (IntentosFallidos >= 0)
);
GO

CREATE TABLE dbo.RefreshToken (
    IDRefreshToken       INT IDENTITY(1,1) NOT NULL,
    IDUsuario            INT               NOT NULL,
    TokenHash            CHAR(64)          NOT NULL,
    FechaExpira          DATETIME2(0)      NOT NULL,
    FechaRevocado        DATETIME2(0)      NULL,
    IDTokenReemplazo     INT               NULL,
    DireccionIP          NVARCHAR(45)      NULL,
    FechaCreacion        DATETIME2(0)      NOT NULL CONSTRAINT DF_RefreshToken_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_RefreshToken PRIMARY KEY CLUSTERED (IDRefreshToken),
    CONSTRAINT UQ_RefreshToken_TokenHash UNIQUE (TokenHash),
    CONSTRAINT FK_RefreshToken_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_RefreshToken_Reemplazo FOREIGN KEY (IDTokenReemplazo) REFERENCES dbo.RefreshToken (IDRefreshToken)
);
GO

CREATE NONCLUSTERED INDEX IX_RefreshToken_Usuario
    ON dbo.RefreshToken (IDUsuario)
    INCLUDE (FechaExpira, FechaRevocado);
GO

CREATE TABLE dbo.Direccion (
    IDDireccion      INT IDENTITY(1,1) NOT NULL,
    IDUsuario        INT               NOT NULL,
    Alias            NVARCHAR(50)      NOT NULL,
    NombreReceptor   NVARCHAR(150)     NOT NULL,
    Telefono         NVARCHAR(20)      NOT NULL,
    Linea1           NVARCHAR(200)     NOT NULL,
    Linea2           NVARCHAR(200)     NULL,
    Municipio        NVARCHAR(100)     NOT NULL,
    Departamento     NVARCHAR(100)     NOT NULL,
    CodigoPostal     NVARCHAR(10)      NULL,
    Referencia       NVARCHAR(300)     NULL,
    Activo           BIT               NOT NULL CONSTRAINT DF_Direccion_Activo DEFAULT (1),
    FechaCreacion    DATETIME2(0)      NOT NULL CONSTRAINT DF_Direccion_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Direccion PRIMARY KEY CLUSTERED (IDDireccion),
    CONSTRAINT FK_Direccion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario)
);
GO

CREATE NONCLUSTERED INDEX IX_Direccion_Usuario
    ON dbo.Direccion (IDUsuario)
    WHERE Activo = 1;
GO

/* ------------------------------------------------------------
   Catálogo (RF-02)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Categoria (
    IDCategoria      INT IDENTITY(1,1) NOT NULL,
    Nombre           NVARCHAR(100)     NOT NULL,
    Descripcion      NVARCHAR(300)     NULL,
    Activo           BIT               NOT NULL CONSTRAINT DF_Categoria_Activo DEFAULT (1),
    FechaCreacion    DATETIME2(0)      NOT NULL CONSTRAINT DF_Categoria_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Categoria PRIMARY KEY CLUSTERED (IDCategoria),
    CONSTRAINT UQ_Categoria_Nombre UNIQUE (Nombre)
);
GO

CREATE TABLE dbo.Producto (
    IDProducto           INT IDENTITY(1,1) NOT NULL,
    IDCategoria          INT               NOT NULL,
    Nombre               NVARCHAR(200)     NOT NULL,
    Descripcion          NVARCHAR(MAX)     NULL,
    Activo               BIT               NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT (1),
    FechaCreacion        DATETIME2(0)      NOT NULL CONSTRAINT DF_Producto_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion   DATETIME2(0)      NULL,
    CONSTRAINT PK_Producto PRIMARY KEY CLUSTERED (IDProducto),
    CONSTRAINT FK_Producto_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria)
);
GO

CREATE NONCLUSTERED INDEX IX_Producto_Categoria
    ON dbo.Producto (IDCategoria, Activo);
GO

CREATE TABLE dbo.ProductoImagen (
    IDProductoImagen INT IDENTITY(1,1) NOT NULL,
    IDProducto       INT               NOT NULL,
    Url              NVARCHAR(500)     NOT NULL,
    Orden            INT               NOT NULL CONSTRAINT DF_ProductoImagen_Orden DEFAULT (0),
    EsPrincipal      BIT               NOT NULL CONSTRAINT DF_ProductoImagen_EsPrincipal DEFAULT (0),
    CONSTRAINT PK_ProductoImagen PRIMARY KEY CLUSTERED (IDProductoImagen),
    CONSTRAINT FK_ProductoImagen_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto (IDProducto),
    CONSTRAINT CK_ProductoImagen_Orden CHECK (Orden >= 0)
);
GO

CREATE TABLE dbo.Variante (
    IDVariante           INT IDENTITY(1,1) NOT NULL,
    IDProducto           INT               NOT NULL,
    SKU                  NVARCHAR(50)      NOT NULL,
    Precio               DECIMAL(18,2)     NOT NULL,
    Existencia           INT               NOT NULL CONSTRAINT DF_Variante_Existencia DEFAULT (0),
    Activo               BIT               NOT NULL CONSTRAINT DF_Variante_Activo DEFAULT (1),
    FechaCreacion        DATETIME2(0)      NOT NULL CONSTRAINT DF_Variante_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion   DATETIME2(0)      NULL,
    CONSTRAINT PK_Variante PRIMARY KEY CLUSTERED (IDVariante),
    CONSTRAINT UQ_Variante_SKU UNIQUE (SKU),
    CONSTRAINT FK_Variante_Producto FOREIGN KEY (IDProducto) REFERENCES dbo.Producto (IDProducto),
    CONSTRAINT CK_Variante_Precio CHECK (Precio >= 0),
    CONSTRAINT CK_Variante_Existencia CHECK (Existencia >= 0)
);
GO

CREATE NONCLUSTERED INDEX IX_Variante_Producto
    ON dbo.Variante (IDProducto, Activo)
    INCLUDE (Precio, Existencia);
GO

CREATE TABLE dbo.VarianteAtributo (
    IDVarianteAtributo INT IDENTITY(1,1) NOT NULL,
    IDVariante         INT               NOT NULL,
    Nombre             NVARCHAR(50)      NOT NULL,
    Valor              NVARCHAR(100)     NOT NULL,
    CONSTRAINT PK_VarianteAtributo PRIMARY KEY CLUSTERED (IDVarianteAtributo),
    CONSTRAINT FK_VarianteAtributo_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT UQ_VarianteAtributo_VarianteNombre UNIQUE (IDVariante, Nombre)
);
GO

/* ------------------------------------------------------------
   Carrito (RF-04)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Carrito (
    IDCarrito              INT IDENTITY(1,1) NOT NULL,
    IDUsuario              INT               NULL,
    TokenInvitado          UNIQUEIDENTIFIER  NULL,
    Estado                 NVARCHAR(20)      NOT NULL CONSTRAINT DF_Carrito_Estado DEFAULT (N'Activo'),
    FechaCreacion          DATETIME2(0)      NOT NULL CONSTRAINT DF_Carrito_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaUltimaActividad   DATETIME2(0)      NOT NULL CONSTRAINT DF_Carrito_FechaUltimaActividad DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Carrito PRIMARY KEY CLUSTERED (IDCarrito),
    CONSTRAINT FK_Carrito_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT UQ_Carrito_TokenInvitado UNIQUE (TokenInvitado),
    CONSTRAINT CK_Carrito_Estado CHECK (Estado IN (N'Activo', N'Convertido', N'Abandonado')),
    CONSTRAINT CK_Carrito_Propietario CHECK (IDUsuario IS NOT NULL OR TokenInvitado IS NOT NULL)
);
GO

CREATE UNIQUE NONCLUSTERED INDEX UX_Carrito_UsuarioActivo
    ON dbo.Carrito (IDUsuario)
    WHERE Estado = N'Activo' AND IDUsuario IS NOT NULL;
GO

CREATE NONCLUSTERED INDEX IX_Carrito_Abandono
    ON dbo.Carrito (FechaUltimaActividad)
    WHERE Estado = N'Activo';
GO

CREATE TABLE dbo.CarritoDetalle (
    IDCarritoDetalle INT IDENTITY(1,1) NOT NULL,
    IDCarrito        INT               NOT NULL,
    IDVariante       INT               NOT NULL,
    Cantidad         INT               NOT NULL,
    FechaAgregado    DATETIME2(0)      NOT NULL CONSTRAINT DF_CarritoDetalle_FechaAgregado DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_CarritoDetalle PRIMARY KEY CLUSTERED (IDCarritoDetalle),
    CONSTRAINT FK_CarritoDetalle_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito),
    CONSTRAINT FK_CarritoDetalle_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT UQ_CarritoDetalle_CarritoVariante UNIQUE (IDCarrito, IDVariante),
    CONSTRAINT CK_CarritoDetalle_Cantidad CHECK (Cantidad > 0)
);
GO

/* ------------------------------------------------------------
   Reservas de existencia (RF-06)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Reserva (
    IDReserva        INT IDENTITY(1,1) NOT NULL,
    IDCarrito        INT               NOT NULL,
    IDVariante       INT               NOT NULL,
    Cantidad         INT               NOT NULL,
    Estado           NVARCHAR(20)      NOT NULL CONSTRAINT DF_Reserva_Estado DEFAULT (N'Activa'),
    FechaExpira      DATETIME2(0)      NOT NULL,
    FechaCreacion    DATETIME2(0)      NOT NULL CONSTRAINT DF_Reserva_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Reserva PRIMARY KEY CLUSTERED (IDReserva),
    CONSTRAINT FK_Reserva_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito),
    CONSTRAINT FK_Reserva_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT CK_Reserva_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Reserva_Estado CHECK (Estado IN (N'Activa', N'Consumida', N'Liberada'))
);
GO

CREATE NONCLUSTERED INDEX IX_Reserva_VarianteActiva
    ON dbo.Reserva (IDVariante, FechaExpira)
    INCLUDE (Cantidad)
    WHERE Estado = N'Activa';
GO

CREATE NONCLUSTERED INDEX IX_Reserva_CarritoActiva
    ON dbo.Reserva (IDCarrito)
    WHERE Estado = N'Activa';
GO

/* ------------------------------------------------------------
   Cupones (RF-05)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Cupon (
    IDCupon                INT IDENTITY(1,1) NOT NULL,
    Codigo                 NVARCHAR(30)      NOT NULL,
    TipoDescuento          NVARCHAR(10)      NOT NULL,
    Valor                  DECIMAL(18,2)     NOT NULL,
    IDCategoria            INT               NULL,
    MontoMinimo            DECIMAL(18,2)     NOT NULL CONSTRAINT DF_Cupon_MontoMinimo DEFAULT (0),
    FechaInicio            DATETIME2(0)      NOT NULL,
    FechaFin               DATETIME2(0)      NOT NULL,
    LimiteUsosTotal        INT               NULL,
    LimiteUsosPorCliente   INT               NULL,
    UsosActuales           INT               NOT NULL CONSTRAINT DF_Cupon_UsosActuales DEFAULT (0),
    Activo                 BIT               NOT NULL CONSTRAINT DF_Cupon_Activo DEFAULT (1),
    FechaCreacion          DATETIME2(0)      NOT NULL CONSTRAINT DF_Cupon_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion     DATETIME2(0)      NULL,
    CONSTRAINT PK_Cupon PRIMARY KEY CLUSTERED (IDCupon),
    CONSTRAINT UQ_Cupon_Codigo UNIQUE (Codigo),
    CONSTRAINT FK_Cupon_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    CONSTRAINT CK_Cupon_TipoDescuento CHECK (TipoDescuento IN (N'PORCENTAJE', N'MONTO')),
    CONSTRAINT CK_Cupon_Valor CHECK (Valor > 0),
    CONSTRAINT CK_Cupon_Porcentaje CHECK (TipoDescuento <> N'PORCENTAJE' OR Valor <= 100),
    CONSTRAINT CK_Cupon_MontoMinimo CHECK (MontoMinimo >= 0),
    CONSTRAINT CK_Cupon_Vigencia CHECK (FechaFin > FechaInicio),
    CONSTRAINT CK_Cupon_LimiteUsosTotal CHECK (LimiteUsosTotal IS NULL OR LimiteUsosTotal > 0),
    CONSTRAINT CK_Cupon_LimiteUsosPorCliente CHECK (LimiteUsosPorCliente IS NULL OR LimiteUsosPorCliente > 0),
    CONSTRAINT CK_Cupon_UsosActuales CHECK (UsosActuales >= 0 AND (LimiteUsosTotal IS NULL OR UsosActuales <= LimiteUsosTotal))
);
GO

/* ------------------------------------------------------------
   Pedidos (RF-06, RF-07)
   ------------------------------------------------------------ */
CREATE TABLE dbo.EstadoPedido (
    IDEstadoPedido   INT IDENTITY(1,1) NOT NULL,
    Codigo           NVARCHAR(30)      NOT NULL,
    Nombre           NVARCHAR(50)      NOT NULL,
    EsFinal          BIT               NOT NULL CONSTRAINT DF_EstadoPedido_EsFinal DEFAULT (0),
    Orden            INT               NOT NULL,
    CONSTRAINT PK_EstadoPedido PRIMARY KEY CLUSTERED (IDEstadoPedido),
    CONSTRAINT UQ_EstadoPedido_Codigo UNIQUE (Codigo)
);
GO

CREATE TABLE dbo.TransicionEstadoPedido (
    IDTransicionEstadoPedido INT IDENTITY(1,1) NOT NULL,
    IDEstadoOrigen           INT               NOT NULL,
    IDEstadoDestino          INT               NOT NULL,
    IDRolRequerido           INT               NULL,
    CONSTRAINT PK_TransicionEstadoPedido PRIMARY KEY CLUSTERED (IDTransicionEstadoPedido),
    CONSTRAINT FK_TransicionEstadoPedido_Origen FOREIGN KEY (IDEstadoOrigen) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_TransicionEstadoPedido_Destino FOREIGN KEY (IDEstadoDestino) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_TransicionEstadoPedido_Rol FOREIGN KEY (IDRolRequerido) REFERENCES dbo.Rol (IDRol),
    CONSTRAINT UQ_TransicionEstadoPedido_OrigenDestino UNIQUE (IDEstadoOrigen, IDEstadoDestino),
    CONSTRAINT CK_TransicionEstadoPedido_Distintos CHECK (IDEstadoOrigen <> IDEstadoDestino)
);
GO

CREATE TABLE dbo.Pedido (
    IDPedido               INT IDENTITY(1,1) NOT NULL,
    NumeroPedido           NVARCHAR(20)      NOT NULL,
    IDUsuario              INT               NOT NULL,
    IDEstadoPedido         INT               NOT NULL,
    IDDireccion            INT               NOT NULL,
    IDCupon                INT               NULL,
    DireccionEntrega       NVARCHAR(600)     NOT NULL,
    Subtotal               DECIMAL(18,2)     NOT NULL,
    Descuento              DECIMAL(18,2)     NOT NULL CONSTRAINT DF_Pedido_Descuento DEFAULT (0),
    CostoEnvio             DECIMAL(18,2)     NOT NULL CONSTRAINT DF_Pedido_CostoEnvio DEFAULT (0),
    Total                  DECIMAL(18,2)     NOT NULL,
    BaseImponible          DECIMAL(18,2)     NOT NULL,
    IVA                    DECIMAL(18,2)     NOT NULL,
    PorcentajeIVA          DECIMAL(5,2)      NOT NULL,
    FechaCreacion          DATETIME2(0)      NOT NULL CONSTRAINT DF_Pedido_FechaCreacion DEFAULT (SYSUTCDATETIME()),
    FechaActualizacion     DATETIME2(0)      NULL,
    CONSTRAINT PK_Pedido PRIMARY KEY CLUSTERED (IDPedido),
    CONSTRAINT UQ_Pedido_NumeroPedido UNIQUE (NumeroPedido),
    CONSTRAINT FK_Pedido_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Pedido_EstadoPedido FOREIGN KEY (IDEstadoPedido) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_Pedido_Direccion FOREIGN KEY (IDDireccion) REFERENCES dbo.Direccion (IDDireccion),
    CONSTRAINT FK_Pedido_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT CK_Pedido_Subtotal CHECK (Subtotal >= 0),
    CONSTRAINT CK_Pedido_Descuento CHECK (Descuento >= 0 AND Descuento <= Subtotal),
    CONSTRAINT CK_Pedido_CostoEnvio CHECK (CostoEnvio >= 0),
    CONSTRAINT CK_Pedido_Total CHECK (Total >= 0),
    CONSTRAINT CK_Pedido_Impuestos CHECK (BaseImponible >= 0 AND IVA >= 0 AND PorcentajeIVA >= 0)
);
GO

CREATE NONCLUSTERED INDEX IX_Pedido_FechaEstado
    ON dbo.Pedido (FechaCreacion, IDEstadoPedido)
    INCLUDE (Total, IDUsuario);
GO

CREATE NONCLUSTERED INDEX IX_Pedido_Usuario
    ON dbo.Pedido (IDUsuario, FechaCreacion DESC);
GO

CREATE TABLE dbo.PedidoDetalle (
    IDPedidoDetalle        INT IDENTITY(1,1) NOT NULL,
    IDPedido               INT               NOT NULL,
    IDVariante             INT               NOT NULL,
    SKU                    NVARCHAR(50)      NOT NULL,
    NombreProducto         NVARCHAR(200)     NOT NULL,
    DescripcionVariante    NVARCHAR(300)     NULL,
    IDCategoria            INT               NOT NULL,
    Cantidad               INT               NOT NULL,
    PrecioUnitario         DECIMAL(18,2)     NOT NULL,
    DescuentoLinea         DECIMAL(18,2)     NOT NULL CONSTRAINT DF_PedidoDetalle_DescuentoLinea DEFAULT (0),
    TotalLinea             DECIMAL(18,2)     NOT NULL,
    CantidadDevuelta       INT               NOT NULL CONSTRAINT DF_PedidoDetalle_CantidadDevuelta DEFAULT (0),
    CONSTRAINT PK_PedidoDetalle PRIMARY KEY CLUSTERED (IDPedidoDetalle),
    CONSTRAINT FK_PedidoDetalle_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_PedidoDetalle_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_PedidoDetalle_Categoria FOREIGN KEY (IDCategoria) REFERENCES dbo.Categoria (IDCategoria),
    CONSTRAINT UQ_PedidoDetalle_PedidoVariante UNIQUE (IDPedido, IDVariante),
    CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_PedidoDetalle_PrecioUnitario CHECK (PrecioUnitario >= 0),
    CONSTRAINT CK_PedidoDetalle_DescuentoLinea CHECK (DescuentoLinea >= 0),
    CONSTRAINT CK_PedidoDetalle_TotalLinea CHECK (TotalLinea >= 0),
    CONSTRAINT CK_PedidoDetalle_CantidadDevuelta CHECK (CantidadDevuelta >= 0 AND CantidadDevuelta <= Cantidad)
);
GO

CREATE NONCLUSTERED INDEX IX_PedidoDetalle_Variante
    ON dbo.PedidoDetalle (IDVariante)
    INCLUDE (Cantidad, TotalLinea, CantidadDevuelta);
GO

CREATE NONCLUSTERED INDEX IX_PedidoDetalle_Categoria
    ON dbo.PedidoDetalle (IDCategoria)
    INCLUDE (IDPedido, TotalLinea);
GO

CREATE TABLE dbo.PedidoHistorialEstado (
    IDPedidoHistorialEstado INT IDENTITY(1,1) NOT NULL,
    IDPedido                INT               NOT NULL,
    IDEstadoAnterior        INT               NULL,
    IDEstadoNuevo           INT               NOT NULL,
    IDUsuario               INT               NOT NULL,
    Comentario              NVARCHAR(300)     NULL,
    Fecha                   DATETIME2(0)      NOT NULL CONSTRAINT DF_PedidoHistorialEstado_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_PedidoHistorialEstado PRIMARY KEY CLUSTERED (IDPedidoHistorialEstado),
    CONSTRAINT FK_PedidoHistorialEstado_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_PedidoHistorialEstado_Anterior FOREIGN KEY (IDEstadoAnterior) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_PedidoHistorialEstado_Nuevo FOREIGN KEY (IDEstadoNuevo) REFERENCES dbo.EstadoPedido (IDEstadoPedido),
    CONSTRAINT FK_PedidoHistorialEstado_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario)
);
GO

CREATE NONCLUSTERED INDEX IX_PedidoHistorialEstado_Pedido
    ON dbo.PedidoHistorialEstado (IDPedido, Fecha);
GO

/* ------------------------------------------------------------
   Pago simulado e idempotencia (RF-06)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Pago (
    IDPago               INT IDENTITY(1,1) NOT NULL,
    IDCarrito            INT               NOT NULL,
    IDPedido             INT               NULL,
    IDUsuario            INT               NOT NULL,
    ClaveIdempotencia    NVARCHAR(100)     NOT NULL,
    Monto                DECIMAL(18,2)     NOT NULL,
    MetodoPago           NVARCHAR(30)      NOT NULL,
    Estado               NVARCHAR(20)      NOT NULL,
    MensajeResultado     NVARCHAR(300)     NULL,
    Fecha                DATETIME2(0)      NOT NULL CONSTRAINT DF_Pago_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Pago PRIMARY KEY CLUSTERED (IDPago),
    CONSTRAINT UQ_Pago_ClaveIdempotencia UNIQUE (ClaveIdempotencia),
    CONSTRAINT FK_Pago_Carrito FOREIGN KEY (IDCarrito) REFERENCES dbo.Carrito (IDCarrito),
    CONSTRAINT FK_Pago_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_Pago_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Pago_Monto CHECK (Monto >= 0),
    CONSTRAINT CK_Pago_Estado CHECK (Estado IN (N'Aprobado', N'Rechazado')),
    CONSTRAINT CK_Pago_PedidoSiAprobado CHECK (Estado <> N'Aprobado' OR IDPedido IS NOT NULL)
);
GO

CREATE TABLE dbo.CuponUso (
    IDCuponUso   INT IDENTITY(1,1) NOT NULL,
    IDCupon      INT               NOT NULL,
    IDUsuario    INT               NOT NULL,
    IDPedido     INT               NOT NULL,
    Fecha        DATETIME2(0)      NOT NULL CONSTRAINT DF_CuponUso_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_CuponUso PRIMARY KEY CLUSTERED (IDCuponUso),
    CONSTRAINT FK_CuponUso_Cupon FOREIGN KEY (IDCupon) REFERENCES dbo.Cupon (IDCupon),
    CONSTRAINT FK_CuponUso_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_CuponUso_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT UQ_CuponUso_Pedido UNIQUE (IDPedido)
);
GO

CREATE NONCLUSTERED INDEX IX_CuponUso_CuponUsuario
    ON dbo.CuponUso (IDCupon, IDUsuario);
GO

/* ------------------------------------------------------------
   Inventario y kardex (RF-03)
   ------------------------------------------------------------ */
CREATE TABLE dbo.TipoMovimientoInventario (
    IDTipoMovimientoInventario INT IDENTITY(1,1) NOT NULL,
    Codigo                     NVARCHAR(30)      NOT NULL,
    Nombre                     NVARCHAR(60)      NOT NULL,
    Signo                      SMALLINT          NOT NULL,
    CONSTRAINT PK_TipoMovimientoInventario PRIMARY KEY CLUSTERED (IDTipoMovimientoInventario),
    CONSTRAINT UQ_TipoMovimientoInventario_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_TipoMovimientoInventario_Signo CHECK (Signo IN (-1, 1))
);
GO

CREATE TABLE dbo.Kardex (
    IDKardex                   INT IDENTITY(1,1) NOT NULL,
    IDVariante                 INT               NOT NULL,
    IDTipoMovimientoInventario INT               NOT NULL,
    Cantidad                   INT               NOT NULL,
    ExistenciaResultante       INT               NOT NULL,
    Motivo                     NVARCHAR(300)     NOT NULL,
    IDUsuario                  INT               NOT NULL,
    IDPedido                   INT               NULL,
    Fecha                      DATETIME2(0)      NOT NULL CONSTRAINT DF_Kardex_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Kardex PRIMARY KEY CLUSTERED (IDKardex),
    CONSTRAINT FK_Kardex_Variante FOREIGN KEY (IDVariante) REFERENCES dbo.Variante (IDVariante),
    CONSTRAINT FK_Kardex_TipoMovimiento FOREIGN KEY (IDTipoMovimientoInventario) REFERENCES dbo.TipoMovimientoInventario (IDTipoMovimientoInventario),
    CONSTRAINT FK_Kardex_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT FK_Kardex_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT CK_Kardex_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Kardex_ExistenciaResultante CHECK (ExistenciaResultante >= 0),
    CONSTRAINT CK_Kardex_Motivo CHECK (LEN(LTRIM(RTRIM(Motivo))) > 0)
);
GO

CREATE NONCLUSTERED INDEX IX_Kardex_Variante
    ON dbo.Kardex (IDVariante, Fecha)
    INCLUDE (IDTipoMovimientoInventario, Cantidad);
GO

/* ------------------------------------------------------------
   Devoluciones (RF-07)
   ------------------------------------------------------------ */
CREATE TABLE dbo.Devolucion (
    IDDevolucion       INT IDENTITY(1,1) NOT NULL,
    IDPedido           INT               NOT NULL,
    IDUsuario          INT               NOT NULL,
    Motivo             NVARCHAR(300)     NOT NULL,
    MontoReintegrado   DECIMAL(18,2)     NOT NULL,
    Fecha              DATETIME2(0)      NOT NULL CONSTRAINT DF_Devolucion_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Devolucion PRIMARY KEY CLUSTERED (IDDevolucion),
    CONSTRAINT FK_Devolucion_Pedido FOREIGN KEY (IDPedido) REFERENCES dbo.Pedido (IDPedido),
    CONSTRAINT FK_Devolucion_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Devolucion_MontoReintegrado CHECK (MontoReintegrado >= 0)
);
GO

CREATE NONCLUSTERED INDEX IX_Devolucion_Pedido
    ON dbo.Devolucion (IDPedido);
GO

CREATE TABLE dbo.DevolucionDetalle (
    IDDevolucionDetalle INT IDENTITY(1,1) NOT NULL,
    IDDevolucion        INT               NOT NULL,
    IDPedidoDetalle     INT               NOT NULL,
    Cantidad            INT               NOT NULL,
    MontoLinea          DECIMAL(18,2)     NOT NULL,
    CONSTRAINT PK_DevolucionDetalle PRIMARY KEY CLUSTERED (IDDevolucionDetalle),
    CONSTRAINT FK_DevolucionDetalle_Devolucion FOREIGN KEY (IDDevolucion) REFERENCES dbo.Devolucion (IDDevolucion),
    CONSTRAINT FK_DevolucionDetalle_PedidoDetalle FOREIGN KEY (IDPedidoDetalle) REFERENCES dbo.PedidoDetalle (IDPedidoDetalle),
    CONSTRAINT CK_DevolucionDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_DevolucionDetalle_MontoLinea CHECK (MontoLinea >= 0)
);
GO

/* ------------------------------------------------------------
   Bitácora inmutable (RF-09)
   Los DENY de UPDATE/DELETE se aplican en 003_Security.sql
   ------------------------------------------------------------ */
CREATE TABLE dbo.Bitacora (
    IDBitacora       BIGINT IDENTITY(1,1) NOT NULL,
    Modulo           NVARCHAR(50)         NOT NULL,
    Entidad          NVARCHAR(100)        NOT NULL,
    IDEntidad        INT                  NOT NULL,
    Accion           NVARCHAR(20)         NOT NULL,
    ValorAnterior    NVARCHAR(MAX)        NULL,
    ValorNuevo       NVARCHAR(MAX)        NULL,
    IDUsuario        INT                  NULL,
    Fecha            DATETIME2(0)         NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Bitacora PRIMARY KEY CLUSTERED (IDBitacora),
    CONSTRAINT FK_Bitacora_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_Bitacora_Accion CHECK (Accion IN (N'CREAR', N'MODIFICAR', N'DESACTIVAR'))
);
GO

CREATE NONCLUSTERED INDEX IX_Bitacora_ModuloFecha
    ON dbo.Bitacora (Modulo, Fecha DESC)
    INCLUDE (Entidad, IDEntidad, Accion, IDUsuario);
GO