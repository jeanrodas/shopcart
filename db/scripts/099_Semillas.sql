/* ============================================================
   099_Semillas.sql
   ShopCart - Datos de ejemplo para desarrollo/pruebas (idempotente).

   Este archivo crece con cada modulo; mantener las secciones separadas por
   modulo. Idempotente: comprueba existencia por clave natural antes de insertar.

   Orden de ejecucion: ultimo (despues de 004-007 y de los scripts de cada modulo).

   NOTA DE SEGURIDAD: Admin123!, Operador123! y Cliente123! son contrasenas de
   EVALUACION/DESARROLLO publicas (ver README "Credenciales de prueba"). En un
   ambiente real este archivo de semillas NO se aplica: los usuarios se crean con
   contrasenas unicas fuera del control de versiones (p. ej. por un alta inicial del
   Administrador o un secreto de despliegue) y se rotan periodicamente.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

/* ============================================================
   M1 - Autenticacion, usuarios y direcciones (RF-01)
   ============================================================ */

/* Usuarios de prueba (bcryptjs, cost 10):
   admin@shopcart.local    / Admin123!     (Administrador)
   operador@shopcart.local / Operador123!  (Operador)
   cliente@shopcart.local  / Cliente123!   (Cliente) */

IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = N'admin@shopcart.local')
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, N'admin@shopcart.local',
           N'$2b$10$.8iwa1p0mhFSaV8/z1gViuTxWoikONwiOSuMYoQV4ufbSCIqWWU7y',
           N'Administrador ShopCart'
    FROM dbo.Rol r WHERE r.Nombre = N'Administrador';

IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = N'operador@shopcart.local')
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, N'operador@shopcart.local',
           N'$2b$10$Kp9.7u9VSTHhtIVFPObs8ukGEDecSkzf7VvahFTu0HquycDvgFyqW',
           N'Operador ShopCart'
    FROM dbo.Rol r WHERE r.Nombre = N'Operador';

IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE Correo = N'cliente@shopcart.local')
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, N'cliente@shopcart.local',
           N'$2b$10$ESr6NozUG8lCqPJtgzbLBeVVgGe64DVT.61MZeVUJTlDUR3/SBrSK',
           N'Cliente ShopCart'
    FROM dbo.Rol r WHERE r.Nombre = N'Cliente';
GO

/* Direccion activa del cliente de prueba */
IF NOT EXISTS (
        SELECT 1
        FROM dbo.Direccion d
        INNER JOIN dbo.Usuario u ON u.IDUsuario = d.IDUsuario
        WHERE u.Correo = N'cliente@shopcart.local' AND d.Alias = N'Casa')
    INSERT dbo.Direccion (IDUsuario, Alias, NombreReceptor, Telefono,
                          Linea1, Linea2, Municipio, Departamento, CodigoPostal, Referencia)
    SELECT u.IDUsuario, N'Casa', N'Cliente ShopCart', N'+502 5555-0000',
           N'1a Calle 2-34 Zona 1', NULL, N'Guatemala', N'Guatemala', N'01001',
           N'Casa de dos niveles, porton negro'
    FROM dbo.Usuario u
    WHERE u.Correo = N'cliente@shopcart.local';
GO

/* ============================================================
   M2 - Catalogo de productos Gasolineras Don Arturo (RF-02)
   Lubricantes, aditivos/fluidos, accesorios de vehiculo y tienda RinoMart.
   Idempotente por Nombre (categoria/producto) y por SKU/Url. No inserta
   Existencia ni kardex (eso es M3): las variantes nacen en 0.
   ============================================================ */

/* Categorias: 4 activas + 1 inactiva (para probar el filtro) */
INSERT dbo.Categoria (Nombre, Descripcion, Activo)
SELECT x.Nombre, x.Descripcion, x.Activo
FROM (VALUES
    (N'Lubricantes',        N'Aceites para motor y transmision',       1),
    (N'Aditivos y Fluidos', N'Aditivos, refrigerantes y fluidos',      1),
    (N'Accesorios',         N'Accesorios y consumibles para vehiculo', 1),
    (N'Conveniencia',       N'Productos de tienda RinoMart',           1),
    (N'Descontinuados',     N'Categoria inactiva de ejemplo',          0)
) x(Nombre, Descripcion, Activo)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Categoria c WHERE c.Nombre = x.Nombre);
GO

/* Productos: 12 activos repartidos + 1 inactivo */
INSERT dbo.Producto (IDCategoria, Nombre, Descripcion, Activo)
SELECT c.IDCategoria, x.Nombre, x.Descripcion, x.Activo
FROM (VALUES
    (N'Lubricantes',        N'Aceite Sintetico Motor',     N'Aceite 100% sintetico para motor a gasolina', 1),
    (N'Lubricantes',        N'Aceite Semisintetico Motor', N'Aceite semisintetico multigrado',             1),
    (N'Lubricantes',        N'Aceite para Moto',           N'Aceite para motores de motocicleta 4T',       1),
    (N'Lubricantes',        N'Aceite de Transmision',      N'Aceite para transmision automatica/manual',   1),
    (N'Aditivos y Fluidos', N'Aditivo Ultra',              N'Aditivo mejorador de combustible',            1),
    (N'Aditivos y Fluidos', N'Refrigerante de Motor',      N'Refrigerante anticongelante concentrado',     1),
    (N'Aditivos y Fluidos', N'Liquido de Frenos',          N'Liquido de frenos DOT',                       1),
    (N'Accesorios',         N'Filtro de Aceite',           N'Filtro de aceite para motor',                 1),
    (N'Accesorios',         N'Limpiaparabrisas',           N'Liquido limpiaparabrisas listo para usar',    1),
    (N'Accesorios',         N'Ambientador para Auto',      N'Ambientador de aroma para vehiculo',          1),
    (N'Conveniencia',       N'Cafe Oasis Molido',          N'Cafe tostado y molido de la linea Oasis, en bolsa', 1),
    (N'Conveniencia',       N'Agua Pura en Fardo',         N'Fardo de agua pura embotellada',              1),
    (N'Descontinuados',     N'Aceite Edicion Anterior',    N'Producto inactivo de ejemplo',                0)
) x(Categoria, Nombre, Descripcion, Activo)
INNER JOIN dbo.Categoria c ON c.Nombre = x.Categoria
WHERE NOT EXISTS (SELECT 1 FROM dbo.Producto p WHERE p.Nombre = x.Nombre);
GO

/* Variantes (SKU unico patron CAT-PROD-ATRIB1-ATRIB2). Una inactiva en el
   producto descontinuado (Aceite Edicion Anterior). */
INSERT dbo.Variante (IDProducto, SKU, Precio, Activo)
SELECT p.IDProducto, x.SKU, x.Precio, x.Activo
FROM (VALUES
    (N'Aceite Sintetico Motor',     N'LUB-SIN-5W30-1QT',   85.00, 1),
    (N'Aceite Sintetico Motor',     N'LUB-SIN-5W30-GAL',  320.00, 1),
    (N'Aceite Semisintetico Motor', N'LUB-SEM-10W40-1QT',  65.00, 1),
    (N'Aceite Semisintetico Motor', N'LUB-SEM-20W50-GAL', 240.00, 1),
    (N'Aceite para Moto',           N'LUB-MOT-20W50-1QT',  55.00, 1),
    (N'Aceite de Transmision',      N'LUB-TRA-ATF-1QT',    70.00, 1),
    (N'Aceite de Transmision',      N'LUB-TRA-ATF-GAL',   260.00, 1),
    (N'Aditivo Ultra',              N'ADI-ULT-CONC-350',   45.00, 1),
    (N'Aditivo Ultra',              N'ADI-ULT-CONC-1L',   110.00, 1),
    (N'Refrigerante de Motor',      N'ADI-REF-VERDE-1GAL', 95.00, 1),
    (N'Refrigerante de Motor',      N'ADI-REF-ROJO-1GAL',  99.00, 1),
    (N'Liquido de Frenos',          N'ADI-FRE-DOT3-355',   38.00, 1),
    (N'Liquido de Frenos',          N'ADI-FRE-DOT4-355',   48.00, 1),
    (N'Filtro de Aceite',           N'ACC-FIL-UNIV-STD',   55.00, 1),
    (N'Limpiaparabrisas',           N'ACC-LIM-UNIV-1GAL',  35.00, 1),
    (N'Ambientador para Auto',      N'ACC-AMB-NUEVO-UNI',  28.00, 1),
    (N'Ambientador para Auto',      N'ACC-AMB-LAVANDA-UNI',28.00, 1),
    (N'Cafe Oasis Molido',          N'CON-CAF-250G-REG',   35.00, 1),
    (N'Cafe Oasis Molido',          N'CON-CAF-500G-REG',   65.00, 1),
    (N'Agua Pura en Fardo',         N'CON-AGU-600-F24',    60.00, 1),
    (N'Agua Pura en Fardo',         N'CON-AGU-1L-F12',     55.00, 1),
    (N'Aceite Edicion Anterior',    N'LUB-EDA-5W30-1QT',   80.00, 0)
) x(Producto, SKU, Precio, Activo)
INNER JOIN dbo.Producto p ON p.Nombre = x.Producto
WHERE NOT EXISTS (SELECT 1 FROM dbo.Variante v WHERE v.SKU = x.SKU);
GO

/* Atributos de variante (2 por variante; nombres segun la categoria) */
INSERT dbo.VarianteAtributo (IDVariante, Nombre, Valor)
SELECT v.IDVariante, x.Nombre, x.Valor
FROM (VALUES
    (N'LUB-SIN-5W30-1QT',   N'Viscosidad', N'5W-30'),     (N'LUB-SIN-5W30-1QT',   N'Presentacion', N'1 Cuarto'),
    (N'LUB-SIN-5W30-GAL',   N'Viscosidad', N'5W-30'),     (N'LUB-SIN-5W30-GAL',   N'Presentacion', N'1 Galon'),
    (N'LUB-SEM-10W40-1QT',  N'Viscosidad', N'10W-40'),    (N'LUB-SEM-10W40-1QT',  N'Presentacion', N'1 Cuarto'),
    (N'LUB-SEM-20W50-GAL',  N'Viscosidad', N'20W-50'),    (N'LUB-SEM-20W50-GAL',  N'Presentacion', N'1 Galon'),
    (N'LUB-MOT-20W50-1QT',  N'Viscosidad', N'20W-50'),    (N'LUB-MOT-20W50-1QT',  N'Presentacion', N'1 Cuarto'),
    (N'LUB-TRA-ATF-1QT',    N'Viscosidad', N'ATF'),       (N'LUB-TRA-ATF-1QT',    N'Presentacion', N'1 Cuarto'),
    (N'LUB-TRA-ATF-GAL',    N'Viscosidad', N'ATF'),       (N'LUB-TRA-ATF-GAL',    N'Presentacion', N'1 Galon'),
    (N'ADI-ULT-CONC-350',   N'Presentacion', N'350 ml'),  (N'ADI-ULT-CONC-350',   N'Tipo', N'Concentrado'),
    (N'ADI-ULT-CONC-1L',    N'Presentacion', N'1 Litro'), (N'ADI-ULT-CONC-1L',    N'Tipo', N'Concentrado'),
    (N'ADI-REF-VERDE-1GAL', N'Presentacion', N'1 Galon'), (N'ADI-REF-VERDE-1GAL', N'Tipo', N'Verde'),
    (N'ADI-REF-ROJO-1GAL',  N'Presentacion', N'1 Galon'), (N'ADI-REF-ROJO-1GAL',  N'Tipo', N'Rojo'),
    (N'ADI-FRE-DOT3-355',   N'Presentacion', N'355 ml'),  (N'ADI-FRE-DOT3-355',   N'Tipo', N'DOT 3'),
    (N'ADI-FRE-DOT4-355',   N'Presentacion', N'355 ml'),  (N'ADI-FRE-DOT4-355',   N'Tipo', N'DOT 4'),
    (N'ACC-FIL-UNIV-STD',   N'Compatibilidad', N'Universal'),   (N'ACC-FIL-UNIV-STD',   N'Presentacion', N'Unidad'),
    (N'ACC-LIM-UNIV-1GAL',  N'Compatibilidad', N'Universal'),   (N'ACC-LIM-UNIV-1GAL',  N'Presentacion', N'1 Galon'),
    (N'ACC-AMB-NUEVO-UNI',  N'Compatibilidad', N'Universal'),   (N'ACC-AMB-NUEVO-UNI',  N'Presentacion', N'Aroma Auto Nuevo'),
    (N'ACC-AMB-LAVANDA-UNI',N'Compatibilidad', N'Universal'),   (N'ACC-AMB-LAVANDA-UNI',N'Presentacion', N'Aroma Lavanda'),
    (N'CON-CAF-250G-REG',   N'Tamano', N'250 g'),         (N'CON-CAF-250G-REG',   N'Variedad', N'Regular'),
    (N'CON-CAF-500G-REG',   N'Tamano', N'500 g'),         (N'CON-CAF-500G-REG',   N'Variedad', N'Regular'),
    (N'CON-AGU-600-F24',    N'Tamano', N'600 ml'),        (N'CON-AGU-600-F24',    N'Presentacion', N'Fardo de 24'),
    (N'CON-AGU-1L-F12',     N'Tamano', N'1 Litro'),       (N'CON-AGU-1L-F12',     N'Presentacion', N'Fardo de 12'),
    (N'LUB-EDA-5W30-1QT',   N'Viscosidad', N'5W-30'),     (N'LUB-EDA-5W30-1QT',   N'Presentacion', N'1 Cuarto')
) x(SKU, Nombre, Valor)
INNER JOIN dbo.Variante v ON v.SKU = x.SKU
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.VarianteAtributo a
    WHERE a.IDVariante = v.IDVariante AND a.Nombre = x.Nombre);
GO

/* Imagenes servidas por el frontend desde web/public/img/productos (rutas relativas,
   no URLs externas). Una principal por producto; imagen secundaria extra en Aceite
   Sintetico Motor, Aditivo Ultra y Cafe Oasis Molido. */
INSERT dbo.ProductoImagen (IDProducto, Url, Orden, EsPrincipal)
SELECT p.IDProducto, x.Url, x.Orden, x.EsPrincipal
FROM (VALUES
    (N'Aceite Sintetico Motor',     N'/img/productos/LUB-SIN.jpeg',   0, 1),
    (N'Aceite Sintetico Motor',     N'/img/productos/LUB-SIN-2.jpeg', 1, 0),
    (N'Aceite Semisintetico Motor', N'/img/productos/LUB-SEM.jpeg',   0, 1),
    (N'Aceite para Moto',           N'/img/productos/LUB-MOT.jpeg',   0, 1),
    (N'Aceite de Transmision',      N'/img/productos/LUB-TRA.jpeg',   0, 1),
    (N'Aditivo Ultra',              N'/img/productos/ADI-ULT.jpeg',   0, 1),
    (N'Aditivo Ultra',              N'/img/productos/ADI-ULT-2.jpeg', 1, 0),
    (N'Refrigerante de Motor',      N'/img/productos/ADI-REF.jpeg',   0, 1),
    (N'Liquido de Frenos',          N'/img/productos/ADI-FRE.jpeg',   0, 1),
    (N'Filtro de Aceite',           N'/img/productos/ACC-FIL.jpeg',   0, 1),
    (N'Limpiaparabrisas',           N'/img/productos/ACC-LIM.jpeg',   0, 1),
    (N'Ambientador para Auto',      N'/img/productos/ACC-AMB.jpeg',   0, 1),
    (N'Cafe Oasis Molido',          N'/img/productos/CON-CAF.jpeg',   0, 1),
    (N'Cafe Oasis Molido',          N'/img/productos/CON-CAF-2.jpeg', 1, 0),
    (N'Agua Pura en Fardo',         N'/img/productos/CON-AGU.jpeg',   0, 1),
    (N'Aceite Edicion Anterior',    N'/img/productos/LUB-EDA.jpeg',   0, 1)
) x(Producto, Url, Orden, EsPrincipal)
INNER JOIN dbo.Producto p ON p.Nombre = x.Producto
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ProductoImagen i
    WHERE i.IDProducto = p.IDProducto AND i.Url = x.Url);
GO

/* ============================================================
   M3 - Carga inicial de inventario (RF-03)
   Registra la existencia inicial de cada variante activa que aun no tenga
   kardex, SIEMPRE a traves de SP_Inventario_RegistrarMovimiento (ENTRADA_COMPRA);
   nunca modificando Existencia de forma directa. Idempotente: salta las variantes que
   ya tienen movimientos de kardex. Las dos primeras reciben <= 5 unidades para
   que el filtro de bajo stock devuelva resultados.
   ============================================================ */

DECLARE @AdminInv INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'admin@shopcart.local');

IF @AdminInv IS NOT NULL
BEGIN
    DECLARE @IDVarianteInv INT, @Secuencia INT = 0, @CantidadInv INT;

    DECLARE cur_inventario CURSOR LOCAL FAST_FORWARD FOR
        SELECT v.IDVariante
        FROM dbo.Variante v
        WHERE v.Activo = 1
          AND NOT EXISTS (SELECT 1 FROM dbo.Kardex k WHERE k.IDVariante = v.IDVariante)
        ORDER BY v.IDVariante;

    OPEN cur_inventario;
    FETCH NEXT FROM cur_inventario INTO @IDVarianteInv;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Secuencia += 1;
        -- Cantidades variadas (3 a 60); las dos primeras <= 5 para bajo stock.
        SET @CantidadInv = CASE @Secuencia
                               WHEN 1 THEN 3
                               WHEN 2 THEN 5
                               ELSE ((@Secuencia * 7) % 58) + 3
                           END;

        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante       = @IDVarianteInv,
             @CodigoTipo       = N'ENTRADA_COMPRA',
             @Cantidad         = @CantidadInv,
             @Motivo           = N'Carga inicial de inventario',
             @IDUsuarioEjecuta = @AdminInv,
             @SinResultado     = 1;

        FETCH NEXT FROM cur_inventario INTO @IDVarianteInv;
    END

    CLOSE cur_inventario;
    DEALLOCATE cur_inventario;
END
GO

/* ============================================================
   M4 - Carrito de compras (RF-04)
   Un carrito activo del cliente de prueba con 2 lineas y un carrito de invitado
   con token fijo con 1 linea. Ambos se crean via SP_Carrito_AgregarItem (nunca
   con INSERT directo en CarritoDetalle), de modo que respetan la validacion de
   disponible. El carrito NO reserva existencia ni toca Variante/Kardex.
   Idempotente: por usuario (no crea si el cliente ya tiene carrito activo) y por
   token (no crea si el token ya existe).
   ============================================================ */

/* Carrito activo del cliente de prueba (2 lineas). Las cantidades caben en el
   disponible sembrado por la seccion M3. */
DECLARE @IDCliente INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'cliente@shopcart.local');

IF @IDCliente IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.Carrito WHERE IDUsuario = @IDCliente AND Estado = N'Activo')
BEGIN
    DECLARE @IDVar1 INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = N'LUB-SIN-5W30-GAL');
    DECLARE @IDVar2 INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = N'ADI-ULT-CONC-1L');

    IF @IDVar1 IS NOT NULL
        EXEC dbo.SP_Carrito_AgregarItem
             @IDUsuario        = @IDCliente,
             @IDVariante       = @IDVar1,
             @Cantidad         = 2,
             @IDUsuarioEjecuta = @IDCliente;

    IF @IDVar2 IS NOT NULL
        EXEC dbo.SP_Carrito_AgregarItem
             @IDUsuario        = @IDCliente,
             @IDVariante       = @IDVar2,
             @Cantidad         = 1,
             @IDUsuarioEjecuta = @IDCliente;
END
GO

/* Carrito de invitado con TokenInvitado fijo (1 linea). Se envejece la actividad
   3 dias para ejercitar el abandono (estado derivado de M9). */
DECLARE @TokenInvitadoSeed UNIQUEIDENTIFIER = N'11111111-1111-1111-1111-111111111111';

IF NOT EXISTS (SELECT 1 FROM dbo.Carrito WHERE TokenInvitado = @TokenInvitadoSeed)
BEGIN
    DECLARE @IDVarInvitado INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = N'CON-AGU-1L-F12');

    IF @IDVarInvitado IS NOT NULL
    BEGIN
        EXEC dbo.SP_Carrito_AgregarItem
             @TokenInvitado    = @TokenInvitadoSeed,
             @IDVariante       = @IDVarInvitado,
             @Cantidad         = 1,
             @IDUsuarioEjecuta = NULL,
             @CrearSiNoExiste  = 1;

        /* Aceptable SOLO en semillas: ningun SP de M4 modifica la fecha a mano.
           Retrasamos la ultima actividad 3 dias para datos de prueba de abandono. */
        UPDATE dbo.Carrito
           SET FechaUltimaActividad = DATEADD(DAY, -3, SYSUTCDATETIME())
         WHERE TokenInvitado = @TokenInvitadoSeed;
    END
END
GO

/* ============================================================
   M5 - Cupones y promociones (RF-05)
   Catalogo de cupones de ejemplo que cubren cada rama de validacion. En semillas
   es aceptable el INSERT directo en Cupon (los SPs de cupon validan contra un
   carrito; aqui solo se crean definiciones). Idempotente: por Codigo.
   El cupon AGOTADO se siembra YA CONSUMIDO (UsosActuales = 1 con LimiteUsosTotal 1)
   solo para probar la causa 'agotado'; el consumo real de usos es del checkout (M6).
   ============================================================ */

DECLARE @IDCatLub INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Nombre = N'Lubricantes');
DECLARE @IDCatAdi INT = (SELECT IDCategoria FROM dbo.Categoria WHERE Nombre = N'Aditivos y Fluidos');
DECLARE @AhoraCup DATETIME2(0) = SYSUTCDATETIME();

/* PROMO10: 10% sin categoria, vigente, sin limites. La vigencia arranca 60 dias atras para
   cubrir los pedidos de demostracion que lo usan (SEED-004 a 44 dias, SEED-007 a 28). */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'PROMO10')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES (N'PROMO10', N'PORCENTAJE', 10.00, NULL, 0.00, DATEADD(DAY, -60, @AhoraCup), DATEADD(DAY, 21, @AhoraCup), NULL, NULL);

/* LUB50: Q50 fijos sobre Lubricantes, con monto minimo Q300, vigente. */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'LUB50')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES (N'LUB50', N'MONTO', 50.00, @IDCatLub, 300.00, DATEADD(DAY, -60, @AhoraCup), DATEADD(DAY, 45, @AhoraCup), NULL, NULL);

/* ADIT15: 15% sobre Aditivos y Fluidos, sin monto minimo ni limites, vigente ~10 dias.
   Alimenta el recordset de ofertas de SP_Catalogo_Destacados (solo cupones PORCENTAJE). */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'ADIT15')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES (N'ADIT15', N'PORCENTAJE', 15.00, @IDCatAdi, 0.00, DATEADD(DAY, -7, @AhoraCup), DATEADD(DAY, 10, @AhoraCup), NULL, NULL);

/* VENCIDO: 20% cuya vigencia termino ayer. */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'VENCIDO')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES (N'VENCIDO', N'PORCENTAJE', 20.00, NULL, 0.00, DATEADD(DAY, -30, @AhoraCup), DATEADD(DAY, -1, @AhoraCup), NULL, NULL);

/* FUTURO: 15% que entra en vigencia dentro de 30 dias. */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'FUTURO')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES (N'FUTURO', N'PORCENTAJE', 15.00, NULL, 0.00, DATEADD(DAY, 30, @AhoraCup), DATEADD(DAY, 60, @AhoraCup), NULL, NULL);

/* UNAVEZ: Q25 fijos, limite de un uso por cliente, vigente. */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'UNAVEZ')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES (N'UNAVEZ', N'MONTO', 25.00, NULL, 0.00, DATEADD(DAY, -1, @AhoraCup), DATEADD(YEAR, 1, @AhoraCup), NULL, 1);

/* AGOTADO: 5%, limite total de un uso, ya consumido (UsosActuales = 1). Solo pruebas. */
IF NOT EXISTS (SELECT 1 FROM dbo.Cupon WHERE Codigo = N'AGOTADO')
    INSERT dbo.Cupon (Codigo, TipoDescuento, Valor, IDCategoria, MontoMinimo, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente, UsosActuales)
    VALUES (N'AGOTADO', N'PORCENTAJE', 5.00, NULL, 0.00, DATEADD(DAY, -1, @AhoraCup), DATEADD(YEAR, 1, @AhoraCup), 1, NULL, 1);
GO

/* ============================================================
   M6-M9 - Pedidos de demostracion para el dashboard (RF-06 a RF-09)
   Genera ~12 pedidos SOLO a traves de los SPs reales (checkout, cambio de estado,
   devolucion), con claves de idempotencia deterministas 'SEED-xxx'. DESPUES, y SOLO
   en semillas, se retrasan las fechas (Pedido.FechaCreacion, PedidoHistorialEstado.Fecha,
   Pago.Fecha, Kardex.Fecha, Devolucion.Fecha) para repartir los datos en los ultimos
   60 dias y que ventas DIA/SEMANA/MES, categorias, top y el comparativo del resumen
   tengan material. Reparto: 2 PAGADO, 2 EN_PREPARACION, 2 DESPACHADO, 3 ENTREGADO
   (1 con devolucion parcial, 1 con devolucion total -> DEVUELTO), 2 CANCELADO y 1 pago
   RECHAZADO; 2 usan el cupon PROMO10; en 3+ categorias.
   Idempotente: si ya existe el pago 'SEED-001' se salta toda la seccion. Las reservas
   se crean con la hora actual (no se retrasan): no afectan a los reportes.
   ============================================================ */
IF NOT EXISTS (SELECT 1 FROM dbo.Pago WHERE ClaveIdempotencia = N'SEED-001')
BEGIN
    DECLARE @Oper INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'operador@shopcart.local');
    DECLARE @AdminD INT = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = N'admin@shopcart.local');

    /* Dos clientes demo adicionales (hash de 'Cliente123!', mismo que el cliente base). */
    INSERT dbo.Usuario (IDRol, Correo, HashContrasena, Nombre)
    SELECT r.IDRol, x.Correo,
           N'$2b$10$ESr6NozUG8lCqPJtgzbLBeVVgGe64DVT.61MZeVUJTlDUR3/SBrSK', x.Nombre
    FROM (VALUES
        (N'cliente2@shopcart.local', N'Cliente Dos ShopCart'),
        (N'cliente3@shopcart.local', N'Cliente Tres ShopCart')
    ) x(Correo, Nombre)
    CROSS JOIN dbo.Rol r
    WHERE r.Nombre = N'Cliente'
      AND NOT EXISTS (SELECT 1 FROM dbo.Usuario u WHERE u.Correo = x.Correo);

    /* Direccion para cada cliente demo que no la tenga. */
    INSERT dbo.Direccion (IDUsuario, Alias, NombreReceptor, Telefono, Linea1, Municipio, Departamento)
    SELECT u.IDUsuario, N'Casa', u.Nombre, N'+502 5555-0000', N'Avenida Reforma 10-00 Zona 9',
           N'Guatemala', N'Guatemala'
    FROM dbo.Usuario u
    WHERE u.Correo IN (N'cliente2@shopcart.local', N'cliente3@shopcart.local')
      AND NOT EXISTS (SELECT 1 FROM dbo.Direccion d WHERE d.IDUsuario = u.IDUsuario);

    /* Top-up de existencia para los SKUs de la demo (no toca LUB-SIN-5W30-1QT, que
       queda en bajo stock para el resumen). Via SP, sin result set. */
    DECLARE @skuTop NVARCHAR(50), @vTop INT;
    DECLARE cur_top CURSOR LOCAL FAST_FORWARD FOR
        SELECT sku FROM (VALUES
            (N'LUB-SEM-10W40-1QT'), (N'LUB-TRA-ATF-1QT'), (N'LUB-SIN-5W30-GAL'),
            (N'ADI-ULT-CONC-1L'), (N'ADI-REF-VERDE-1GAL'),
            (N'ACC-FIL-UNIV-STD'), (N'CON-CAF-500G-REG')
        ) s(sku);
    OPEN cur_top;
    FETCH NEXT FROM cur_top INTO @skuTop;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @vTop = (SELECT IDVariante FROM dbo.Variante WHERE SKU = @skuTop);
        IF @vTop IS NOT NULL
            EXEC dbo.SP_Inventario_RegistrarMovimiento
                 @IDVariante = @vTop, @CodigoTipo = N'ENTRADA_COMPRA', @Cantidad = 100,
                 @Motivo = N'Reposicion para pedidos demo', @IDUsuarioEjecuta = @AdminD,
                 @SinResultado = 1;
        FETCH NEXT FROM cur_top INTO @skuTop;
    END
    CLOSE cur_top; DEALLOCATE cur_top;

    /* Especificaciones de los pedidos demo. Objetivo controla el estado final. */
    DECLARE @spec TABLE (
        Orden INT IDENTITY(1,1) PRIMARY KEY,
        Clave NVARCHAR(100), Correo NVARCHAR(255), SKU NVARCHAR(50), Cantidad INT,
        Cupon NVARCHAR(30) NULL, Objetivo NVARCHAR(20), Simular NVARCHAR(10), DiasAtras INT
    );
    INSERT @spec (Clave, Correo, SKU, Cantidad, Cupon, Objetivo, Simular, DiasAtras)
    VALUES
        (N'SEED-001', N'cliente@shopcart.local',  N'LUB-SEM-10W40-1QT',  2, NULL,      N'PAGADO',         N'APROBADO', 55),
        (N'SEED-002', N'cliente2@shopcart.local', N'ADI-ULT-CONC-1L',    1, NULL,      N'PAGADO',         N'APROBADO', 52),
        (N'SEED-003', N'cliente3@shopcart.local', N'ACC-FIL-UNIV-STD',   3, NULL,      N'EN_PREPARACION', N'APROBADO', 48),
        (N'SEED-004', N'cliente@shopcart.local',  N'LUB-TRA-ATF-1QT',    2, N'PROMO10',N'EN_PREPARACION', N'APROBADO', 44),
        (N'SEED-005', N'cliente2@shopcart.local', N'CON-CAF-500G-REG',   4, NULL,      N'DESPACHADO',     N'APROBADO', 39),
        (N'SEED-006', N'cliente3@shopcart.local', N'ADI-REF-VERDE-1GAL', 1, NULL,      N'DESPACHADO',     N'APROBADO', 33),
        (N'SEED-007', N'cliente@shopcart.local',  N'LUB-SIN-5W30-GAL',   1, N'PROMO10',N'ENTREGADO',      N'APROBADO', 28),
        (N'SEED-008', N'cliente2@shopcart.local', N'ACC-FIL-UNIV-STD',   2, NULL,      N'PARCIAL',        N'APROBADO', 22),
        (N'SEED-009', N'cliente3@shopcart.local', N'ADI-ULT-CONC-1L',    2, NULL,      N'DEVUELTO',       N'APROBADO', 16),
        (N'SEED-010', N'cliente@shopcart.local',  N'CON-CAF-500G-REG',   3, NULL,      N'CANCELADO',      N'APROBADO', 11),
        (N'SEED-011', N'cliente2@shopcart.local', N'LUB-SEM-10W40-1QT',  1, NULL,      N'CANCELADO',      N'APROBADO',  6),
        (N'SEED-012', N'cliente3@shopcart.local', N'ADI-REF-VERDE-1GAL', 1, NULL,      N'RECHAZADO',      N'RECHAZADO', 3);

    DECLARE @i INT = 1, @n INT = (SELECT MAX(Orden) FROM @spec);
    DECLARE @Clave NVARCHAR(100), @Correo NVARCHAR(255), @SKU NVARCHAR(50), @Cant INT,
            @Cupon NVARCHAR(30), @Obj NVARCHAR(20), @Sim NVARCHAR(10), @Dias INT,
            @Cli INT, @Dir INT, @Var INT, @IDPedido INT, @Base DATETIME2(0);
    DECLARE @Lineas dbo.TVP_DevolucionLinea;

    WHILE @i <= @n
    BEGIN
        SELECT @Clave = Clave, @Correo = Correo, @SKU = SKU, @Cant = Cantidad,
               @Cupon = Cupon, @Obj = Objetivo, @Sim = Simular, @Dias = DiasAtras
        FROM @spec WHERE Orden = @i;

        SET @Cli = (SELECT IDUsuario FROM dbo.Usuario WHERE Correo = @Correo);
        SET @Dir = (SELECT TOP (1) IDDireccion FROM dbo.Direccion WHERE IDUsuario = @Cli AND Activo = 1 ORDER BY IDDireccion);
        SET @Var = (SELECT IDVariante FROM dbo.Variante WHERE SKU = @SKU);

        /* Parte de un carrito limpio: evita arrastrar el carrito demo de M4 (cliente
           base) o una linea de un pago rechazado anterior. Sin carrito activo es no-op. */
        EXEC dbo.SP_Carrito_Vaciar @IDUsuario = @Cli, @IDUsuarioEjecuta = @Cli;

        EXEC dbo.SP_Carrito_AgregarItem
             @IDUsuario = @Cli, @IDVariante = @Var, @Cantidad = @Cant, @IDUsuarioEjecuta = @Cli;

        IF @Cupon IS NOT NULL
            EXEC dbo.SP_Cupones_AplicarACarrito
                 @Codigo = @Cupon, @IDUsuario = @Cli, @IDUsuarioEjecuta = @Cli;

        EXEC dbo.SP_Checkout_Iniciar
             @IDUsuario = @Cli, @IDDireccion = @Dir, @IDUsuarioEjecuta = @Cli;

        EXEC dbo.SP_Pedidos_CrearPedido
             @IDUsuario = @Cli, @IDDireccion = @Dir, @ClaveIdempotencia = @Clave,
             @MetodoPago = N'TARJETA', @SimularResultado = @Sim, @IDUsuarioEjecuta = @Cli;

        SET @IDPedido = (SELECT IDPedido FROM dbo.Pago WHERE ClaveIdempotencia = @Clave);

        IF @Obj = N'RECHAZADO'
        BEGIN
            /* No hay pedido; limpia el carrito para no arrastrar la linea. */
            EXEC dbo.SP_Carrito_Vaciar @IDUsuario = @Cli, @IDUsuarioEjecuta = @Cli;
            UPDATE dbo.Pago SET Fecha = DATEADD(DAY, -@Dias, SYSUTCDATETIME()) WHERE ClaveIdempotencia = @Clave;
        END
        ELSE
        BEGIN
            /* Avance de estados (lo ejecuta el operador). */
            IF @Obj IN (N'EN_PREPARACION', N'DESPACHADO', N'ENTREGADO', N'PARCIAL', N'DEVUELTO')
                EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPedido, @CodigoEstadoDestino = N'EN_PREPARACION',
                     @Comentario = N'Demo', @IDUsuarioEjecuta = @Oper, @RolEjecuta = N'Operador';
            IF @Obj IN (N'DESPACHADO', N'ENTREGADO', N'PARCIAL', N'DEVUELTO')
                EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPedido, @CodigoEstadoDestino = N'DESPACHADO',
                     @Comentario = N'Demo', @IDUsuarioEjecuta = @Oper, @RolEjecuta = N'Operador';
            IF @Obj IN (N'ENTREGADO', N'PARCIAL', N'DEVUELTO')
                EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPedido, @CodigoEstadoDestino = N'ENTREGADO',
                     @Comentario = N'Demo', @IDUsuarioEjecuta = @Oper, @RolEjecuta = N'Operador';
            IF @Obj = N'CANCELADO'
                EXEC dbo.SP_Pedidos_CambiarEstado @IDPedido = @IDPedido, @CodigoEstadoDestino = N'CANCELADO',
                     @Comentario = N'Demo', @IDUsuarioEjecuta = @Oper, @RolEjecuta = N'Operador';

            /* Devoluciones (operador). PARCIAL: 1 unidad; DEVUELTO: todo. */
            IF @Obj IN (N'PARCIAL', N'DEVUELTO')
            BEGIN
                DELETE @Lineas;
                INSERT @Lineas (IDPedidoDetalle, Cantidad)
                SELECT pd.IDPedidoDetalle, CASE WHEN @Obj = N'PARCIAL' THEN 1 ELSE pd.Cantidad END
                FROM dbo.PedidoDetalle pd WHERE pd.IDPedido = @IDPedido;

                EXEC dbo.SP_Pedidos_RegistrarDevolucion
                     @IDPedido = @IDPedido, @Motivo = N'Devolucion demo', @Lineas = @Lineas,
                     @IDUsuarioEjecuta = @Oper;
            END

            /* Retraso de fechas (ACEPTABLE SOLO EN SEMILLAS). */
            SET @Base = DATEADD(DAY, -@Dias, SYSUTCDATETIME());
            UPDATE dbo.Pedido                SET FechaCreacion = @Base, FechaActualizacion = @Base WHERE IDPedido = @IDPedido;
            UPDATE dbo.PedidoHistorialEstado SET Fecha = @Base WHERE IDPedido = @IDPedido;
            UPDATE dbo.Pago                  SET Fecha = @Base WHERE IDPedido = @IDPedido;
            UPDATE dbo.Kardex                SET Fecha = @Base WHERE IDPedido = @IDPedido;
            UPDATE dbo.Devolucion            SET Fecha = @Base WHERE IDPedido = @IDPedido;
        END

        SET @i += 1;
    END
END
GO
