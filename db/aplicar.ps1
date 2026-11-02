<#
.SYNOPSIS
  Instalador de la base de datos ShopCart sobre una instancia NUEVA de SQL Server 2022.

.DESCRIPTION
  Aplica db/scripts/*.sql en el UNICO orden canonico valido para una instancia limpia
  y, al final, imprime conteos de verificacion. Usa sqlcmd del cliente ODBC 18
  (-C confia en el certificado del servidor; -b aborta al primer error de un script).
  Se detiene en el primer script que falle, mostrando su nombre.

.PARAMETER Server
  Instancia de SQL Server. Default: localhost.

.PARAMETER User
  Usuario de SQL Server. Si se omite, se usa autenticacion de Windows (sqlcmd -E).

.PARAMETER Password
  Contrasena del usuario de SQL Server (solo con -User).

.PARAMETER IncluirSemillas
  Aplica 099_Semillas.sql (datos de ejemplo y pedidos demo). Default: $true.

.EXAMPLE
  .\aplicar.ps1
  Instalacion completa con autenticacion de Windows contra localhost, incluyendo semillas.

.EXAMPLE
  .\aplicar.ps1 -Server "localhost\SQLEXPRESS"

.EXAMPLE
  .\aplicar.ps1 -Server db.interno -User sa -Password 'MiPass!' -IncluirSemillas:$false

.PARAMETER AppPassword
  Clave a fijar para el login shopcart_app tras aplicar 003 (ALTER LOGIN). Util en
  produccion, donde 003 lo crea con una clave de desarrollo fija. Se pasa como variable
  de sqlcmd (-v), no concatenada. La clave no debe contener comillas simples.

.EXAMPLE
  .\aplicar.ps1 -User sa -Password 'SaPass!' -AppPassword 'AppPass!'
#>
[CmdletBinding()]
param(
    [string]$Server = 'localhost',
    [string]$User,
    [string]$Password,
    [string]$AppPassword,
    [bool]$IncluirSemillas = $true
)

$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'scripts'

# ===== ORDEN CANONICO UNICO (unica fuente de verdad; ambos README lo referencian) =====
# 012 va DESPUES de 013/014: FU_Carrito_CalcularTotales (012) usa la columna
# Carrito.IDCupon (013) y las funciones de cupon (014), y una funcion en linea exige
# que lo referenciado exista al crearse.
$orden = @(
    '001_CreateDatabase', '002_SP_Sistema_Ping', '003_Security', '004_Catalogos',
    '005_SP_Auth', '006_SP_Usuarios', '007_SP_Direcciones', '008_VW_Inventario',
    '009_SP_Categorias', '010_SP_Catalogo', '011_SP_Inventario',
    '013_Migracion_CarritoCupon', '014_SP_Cupones', '012_SP_Carrito',
    '015_Catalogo_EstadosPedido', '016_SP_Checkout', '017_Migracion_CarritoTokenUnico',
    '018_SP_Pedidos', '019_Bitacora', '020_Reportes'
)
if ($IncluirSemillas) { $orden += '099_Semillas' }

# Argumentos de autenticacion de sqlcmd.
if ($User) { $auth = @('-U', $User, '-P', $Password) } else { $auth = @('-E') }

foreach ($base in $orden) {
    $archivo = Join-Path $dir "$base.sql"
    Write-Host "==> $base.sql"
    & sqlcmd -S $Server @auth -C -b -i $archivo
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Fallo al aplicar $base.sql (sqlcmd exit $LASTEXITCODE). Se detiene la instalacion."
        exit 1
    }
}

# Clave de aplicacion para produccion: 003 crea shopcart_app con una clave fija de
# desarrollo; aqui se cambia por la real. El valor va como variable sqlcmd (-v), no
# concatenado. La clave no debe contener comillas simples.
if ($AppPassword) {
    Write-Host '==> ALTER LOGIN shopcart_app (clave de aplicacion)'
    & sqlcmd -S $Server @auth -C -b -v AppPassword=$AppPassword -Q 'ALTER LOGIN shopcart_app WITH PASSWORD = N''$(AppPassword)'';'
    if ($LASTEXITCODE -ne 0) { Write-Error 'Fallo al fijar la clave de shopcart_app.'; exit 1 }
}

Write-Host "`n== Verificacion =="
$verif = @'
SET NOCOUNT ON;
SELECT 'Tablas (se esperan 26)' AS Objeto, COUNT(*) AS Cantidad FROM sys.tables WHERE is_ms_shipped = 0
UNION ALL SELECT 'Procedimientos', COUNT(*) FROM sys.procedures
UNION ALL SELECT 'Triggers',       COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0
UNION ALL SELECT 'Vistas',         COUNT(*) FROM sys.views
UNION ALL SELECT 'Login shopcart_app', (SELECT COUNT(*) FROM sys.server_principals WHERE name = 'shopcart_app');
'@
& sqlcmd -S $Server @auth -C -b -d ShopCart -Q $verif
if ($LASTEXITCODE -ne 0) { Write-Error 'Fallo la verificacion final.'; exit 1 }

Write-Host "`nInstalacion completada."
