/* ============================================================
   pruebas/bloquear_usuario.sql
   Fixture de prueba (NO forma parte de la instalacion; no va en aplicar.ps1/sh).

   Simula una cuenta bloqueada por intentos fallidos fijando BloqueadoHasta 15
   minutos en el futuro. Lo usa web/tests/control.spec.ts (E6) para ejercer el
   ciclo de UI ver "Bloqueado" -> Desbloquear -> iniciar sesion, sin disparar el
   throttle por IP del login (auth.service frena a los 5 intentos desde una IP,
   antes del lock de BD a los 10).

   Se ejecuta con:  sqlcmd -S localhost -E -C -b -d ShopCart -i <este archivo>
   ============================================================ */
SET NOCOUNT ON;

UPDATE dbo.Usuario
   SET IntentosFallidos = 9,
       BloqueadoHasta   = DATEADD(MINUTE, 15, SYSUTCDATETIME())
 WHERE Correo = N'cliente2@shopcart.local';
GO
