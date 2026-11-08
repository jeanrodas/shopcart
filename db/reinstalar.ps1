<#
.SYNOPSIS
  Reinstala la base ShopCart desde cero: la BORRA (si existe) y vuelve a aplicar aplicar.ps1.

.DESCRIPTION
  DROP DATABASE ShopCart (con SINGLE_USER + ROLLBACK IMMEDIATE para cerrar conexiones) y luego
  ejecuta aplicar.ps1 con los mismos parametros. Pide confirmacion salvo que se pase -Force.
  Pensado para dejar SEMILLAS FRESCAS antes de la suite de pruebas (web: npm run test:e2e).

.PARAMETER Server
  Instancia de SQL Server. Default: localhost.

.PARAMETER User / .PARAMETER Password
  Usuario/clave de SQL Server. Si se omite User, autenticacion de Windows (-E).

.PARAMETER Force
  Omite la confirmacion (uso no interactivo / CI).

.EXAMPLE
  .\reinstalar.ps1 -Force
#>
[CmdletBinding()]
param(
    [string]$Server = 'localhost',
    [string]$User,
    [string]$Password,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not $Force) {
    Write-Host "Esto BORRARA por completo la base 'ShopCart' en $Server y la reinstalara desde cero." -ForegroundColor Yellow
    $resp = Read-Host "Escriba 'si' para continuar"
    if ($resp -ne 'si') { Write-Host 'Cancelado.'; exit 1 }
}

if ($User) { $auth = @('-U', $User, '-P', $Password) } else { $auth = @('-E') }

Write-Host '==> DROP DATABASE ShopCart (si existe)'
& sqlcmd -S $Server @auth -C -b -Q "IF DB_ID('ShopCart') IS NOT NULL BEGIN ALTER DATABASE ShopCart SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ShopCart; END"
if ($LASTEXITCODE -ne 0) { Write-Error 'Fallo al borrar la base ShopCart.'; exit 1 }

# Reaplica el esquema y las semillas con los mismos parametros de autenticacion.
$aplicar = Join-Path $PSScriptRoot 'aplicar.ps1'
$args = @{ Server = $Server }
if ($User) { $args.User = $User; $args.Password = $Password }
& $aplicar @args
exit $LASTEXITCODE
