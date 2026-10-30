/* ============================================================
   099_Semillas.sql
   ShopCart - Datos de ejemplo para desarrollo/pruebas (idempotente).

   Este archivo crece con cada modulo; mantener las secciones separadas por
   modulo. Idempotente: comprueba existencia por clave natural antes de insertar.

   Orden de ejecucion: ultimo (despues de 004-007 y de los scripts de cada modulo).

   NOTA DE SEGURIDAD: los hashes son de contrasenas de DESARROLLO conocidas
   (ver README "Credenciales de prueba"). No usar en ambientes reales.
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
    (N'Conveniencia',       N'Cafe Oasis',                 N'Cafe caliente de la linea Oasis',             1),
    (N'Conveniencia',       N'Agua Pura Embotellada',      N'Agua pura embotellada',                       1),
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
    (N'Cafe Oasis',                 N'CON-CAF-12OZ-REG',   12.00, 1),
    (N'Cafe Oasis',                 N'CON-CAF-16OZ-REG',   15.00, 1),
    (N'Agua Pura Embotellada',      N'CON-AGU-600-SF',      8.00, 1),
    (N'Agua Pura Embotellada',      N'CON-AGU-1L-SF',      10.00, 1),
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
    (N'CON-CAF-12OZ-REG',   N'Tamano', N'12 oz'),         (N'CON-CAF-12OZ-REG',   N'Variedad', N'Regular'),
    (N'CON-CAF-16OZ-REG',   N'Tamano', N'16 oz'),         (N'CON-CAF-16OZ-REG',   N'Variedad', N'Regular'),
    (N'CON-AGU-600-SF',     N'Tamano', N'600 ml'),        (N'CON-AGU-600-SF',     N'Variedad', N'Sin Gas'),
    (N'CON-AGU-1L-SF',      N'Tamano', N'1 Litro'),       (N'CON-AGU-1L-SF',      N'Variedad', N'Sin Gas'),
    (N'LUB-EDA-5W30-1QT',   N'Viscosidad', N'5W-30'),     (N'LUB-EDA-5W30-1QT',   N'Presentacion', N'1 Cuarto')
) x(SKU, Nombre, Valor)
INNER JOIN dbo.Variante v ON v.SKU = x.SKU
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.VarianteAtributo a
    WHERE a.IDVariante = v.IDVariante AND a.Nombre = x.Nombre);
GO

/* Imagenes (placeholder picsum.photos). Una principal por producto; imagen
   secundaria extra en Aceite Sintetico Motor, Aditivo Ultra y Cafe Oasis. */
INSERT dbo.ProductoImagen (IDProducto, Url, Orden, EsPrincipal)
SELECT p.IDProducto, x.Url, x.Orden, x.EsPrincipal
FROM (VALUES
    (N'Aceite Sintetico Motor',     N'https://picsum.photos/seed/LUB-SIN/600/600',   0, 1),
    (N'Aceite Sintetico Motor',     N'https://picsum.photos/seed/LUB-SIN-2/600/600', 1, 0),
    (N'Aceite Semisintetico Motor', N'https://picsum.photos/seed/LUB-SEM/600/600',   0, 1),
    (N'Aceite para Moto',           N'https://picsum.photos/seed/LUB-MOT/600/600',   0, 1),
    (N'Aceite de Transmision',      N'https://picsum.photos/seed/LUB-TRA/600/600',   0, 1),
    (N'Aditivo Ultra',              N'https://picsum.photos/seed/ADI-ULT/600/600',   0, 1),
    (N'Aditivo Ultra',              N'https://picsum.photos/seed/ADI-ULT-2/600/600', 1, 0),
    (N'Refrigerante de Motor',      N'https://picsum.photos/seed/ADI-REF/600/600',   0, 1),
    (N'Liquido de Frenos',          N'https://picsum.photos/seed/ADI-FRE/600/600',   0, 1),
    (N'Filtro de Aceite',           N'https://picsum.photos/seed/ACC-FIL/600/600',   0, 1),
    (N'Limpiaparabrisas',           N'https://picsum.photos/seed/ACC-LIM/600/600',   0, 1),
    (N'Ambientador para Auto',      N'https://picsum.photos/seed/ACC-AMB/600/600',   0, 1),
    (N'Cafe Oasis',                 N'https://picsum.photos/seed/CON-CAF/600/600',   0, 1),
    (N'Cafe Oasis',                 N'https://picsum.photos/seed/CON-CAF-2/600/600', 1, 0),
    (N'Agua Pura Embotellada',      N'https://picsum.photos/seed/CON-AGU/600/600',   0, 1),
    (N'Aceite Edicion Anterior',    N'https://picsum.photos/seed/LUB-EDA/600/600',   0, 1)
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
             @IDUsuarioEjecuta = @AdminInv;

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
    DECLARE @IDVarInvitado INT = (SELECT IDVariante FROM dbo.Variante WHERE SKU = N'CON-AGU-1L-SF');

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
