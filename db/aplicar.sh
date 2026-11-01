#!/usr/bin/env bash
# ============================================================
# Instalador de la base de datos ShopCart (equivalente de aplicar.ps1).
# Aplica db/scripts/*.sql en el UNICO orden canonico valido para una instancia nueva
# y, al final, imprime conteos de verificacion. Usa sqlcmd del cliente ODBC 18
# (-C confia en el certificado; -b aborta al primer error). Se detiene en el primer
# script que falle, mostrando su nombre.
#
# Uso:
#   ./aplicar.sh                              # Windows auth (-E) contra localhost, con semillas
#   ./aplicar.sh -s "localhost\SQLEXPRESS"
#   ./aplicar.sh -s db.interno -u sa -p 'MiPass!' --sin-semillas
#
# Opciones:
#   -s, --server    Instancia (default localhost)
#   -u, --user      Usuario SQL (si se omite, autenticacion de Windows -E)
#   -p, --password  Contrasena del usuario SQL
#       --sin-semillas  No aplicar 099_Semillas.sql
# ============================================================
set -euo pipefail

SERVER="localhost"
USER=""
PASSWORD=""
SEMILLAS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--server)   SERVER="$2"; shift 2 ;;
    -u|--user)     USER="$2"; shift 2 ;;
    -p|--password) PASSWORD="$2"; shift 2 ;;
    --sin-semillas) SEMILLAS=0; shift ;;
    *) echo "Argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

DIR="$(cd "$(dirname "$0")/scripts" && pwd)"

# ===== ORDEN CANONICO UNICO (unica fuente de verdad; ambos README lo referencian) =====
# 012 va DESPUES de 013/014 (FU_Carrito_CalcularTotales usa la columna de cupon y las
# funciones de cupon).
ORDEN=(
  001_CreateDatabase 002_SP_Sistema_Ping 003_Security 004_Catalogos
  005_SP_Auth 006_SP_Usuarios 007_SP_Direcciones 008_VW_Inventario
  009_SP_Categorias 010_SP_Catalogo 011_SP_Inventario
  013_Migracion_CarritoCupon 014_SP_Cupones 012_SP_Carrito
  015_Catalogo_EstadosPedido 016_SP_Checkout 017_Migracion_CarritoTokenUnico
  018_SP_Pedidos 019_Bitacora 020_Reportes
)
[[ $SEMILLAS -eq 1 ]] && ORDEN+=(099_Semillas)

if [[ -n "$USER" ]]; then AUTH=(-U "$USER" -P "$PASSWORD"); else AUTH=(-E); fi

for base in "${ORDEN[@]}"; do
  echo "==> ${base}.sql"
  if ! sqlcmd -S "$SERVER" "${AUTH[@]}" -C -b -i "$DIR/${base}.sql"; then
    echo "Fallo al aplicar ${base}.sql. Se detiene la instalacion." >&2
    exit 1
  fi
done

echo
echo "== Verificacion =="
sqlcmd -S "$SERVER" "${AUTH[@]}" -C -b -d ShopCart -Q "SET NOCOUNT ON; \
SELECT 'Tablas (se esperan 26)' AS Objeto, COUNT(*) AS Cantidad FROM sys.tables WHERE is_ms_shipped = 0 \
UNION ALL SELECT 'Procedimientos', COUNT(*) FROM sys.procedures \
UNION ALL SELECT 'Triggers', COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0 \
UNION ALL SELECT 'Vistas', COUNT(*) FROM sys.views \
UNION ALL SELECT 'Login shopcart_app', (SELECT COUNT(*) FROM sys.server_principals WHERE name = 'shopcart_app');"

echo
echo "Instalacion completada."
