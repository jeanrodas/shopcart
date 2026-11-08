/* ============================================================
   022_Migracion_PedidoFacturacion.sql
   ShopCart - Migracion posterior al 001: datos de facturacion en el pedido.

   Por que una migracion aparte y no el 001: el modelo base (001) no se modifica.
   El pedido debe guardar, como snapshot, a nombre de quien se factura y el NIT (o
   N'CF' para consumidor final), de modo que la factura refleje lo que el cliente
   eligio en el checkout aunque luego cambien sus datos. Esta migracion agrega las
   dos columnas (al final de la tabla) y la restriccion de formato del NIT, sin
   tocar los pedidos existentes (ambas columnas son NULL).

   Validacion de formato unicamente (no hay consulta en linea a la SAT): el CHECK
   solo exige que el NIT sea N'CF' o empiece por digito; el formato fino (p. ej.
   1234567-8) lo valida la API antes de llamar al SP. Supuesto documentado en el
   README.

   Idempotente: COL_LENGTH antes de alterar. Las dos columnas y el CHECK se agregan
   en un unico ALTER TABLE ADD (el CHECK puede referenciar una columna creada en el
   mismo ADD), dentro de una sola transaccion con XACT_ABORT ON: nunca queda un
   estado a medias. Re-ejecutar no cambia nada.

   Orden de ejecucion: despues de 021, antes de 099.
   ============================================================ */

USE ShopCart;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

SET XACT_ABORT ON;
BEGIN TRAN;

    /* Columnas de facturacion (snapshot) y CHECK del formato del NIT. El CHECK se
       crea en el mismo ADD que la columna NITFactura. */
    IF COL_LENGTH('dbo.Pedido', 'NITFactura') IS NULL
        ALTER TABLE dbo.Pedido
            ADD NombreFactura NVARCHAR(150) NULL,
                NITFactura    NVARCHAR(20)  NULL,
                CONSTRAINT CK_Pedido_NITFactura CHECK
                    (NITFactura IS NULL OR NITFactura = N'CF' OR NITFactura LIKE N'[0-9]%');

COMMIT;
GO
