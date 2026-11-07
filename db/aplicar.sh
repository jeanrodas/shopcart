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
#   ./aplicar.sh -s localhost -u sa -p 'SaPass!' -a 'AppPass!'   # fija la clave de shopcart_app
#
# Opciones:
#   -s, --server        Instancia (default localhost)
#   -u, --user          Usuario SQL (si se omite, autenticacion de Windows -E)
#   -p, --password      Contrasena del usuario SQL
#   -a, --app-password  Clave a fijar para el login shopcart_app tras aplicar 003
#                       (ALTER LOGIN). Util en produccion: 003 lo crea con una clave de
#                       desarrollo fija. Se pasa como variable sqlcmd (-v), no concatenada.
#       --sin-semillas  No aplicar 099_Semillas.sql
# ============================================================
set -euo pipefail

SERVER="localhost"
USER=""
PASSWORD=""
APP_PASSWORD=""
SEMILLAS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--server)        SERVER="$2"; shift 2 ;;
    -u|--user)          USER="$2"; shift 2 ;;
    -p|--password)      PASSWORD="$2"; shift 2 ;;
    -a|--app-password)  APP_PASSWORD="$2"; shift 2 ;;
    --sin-semillas)     SEMILLAS=0; shift ;;
    *) echo "Argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

# Resuelve sqlcmd: del PATH o de la ruta del cliente ODBC 18 (imagen de SQL Server 2022).
SQLCMD="$(command -v sqlcmd || true)"
if [[ -z "$SQLCMD" ]]; then
  if [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then SQLCMD=/opt/mssql-tools18/bin/sqlcmd
  elif [[ -x /opt/mssql-tools/bin/sqlcmd ]]; then SQLCMD=/opt/mssql-tools/bin/sqlcmd
  else echo "No se encontro sqlcmd (ni en PATH ni en /opt/mssql-tools18/bin)." >&2; exit 3; fi
fi

DIR="$(cd "$(dirname "$0")/scripts" && pwd)"

# ===== ORDEN CANONICO UNICO (unica fuente de verdad; ambos README lo referencian) =====
# 012 va DESPUES de 013/014 (FU_Carrito_CalcularTotales usa la columna de cupon y las
# funciones de cupon).
ORDEN=(
  001_CreateDatabase 002_SP_Sistema_Ping 003_Security 004_Catalogos
  005_SP_Auth 006_SP_Usuarios 007_SP_Direcciones 008_VW_Inventario
  # 025 (F2) agrega dbo.Variante.ImagenURL; va ANTES de 010/012/016/018/023/024, que
  # referencian la columna (CREATE OR ALTER valida columnas al compilar).
  025_Migracion_VarianteImagen
  009_SP_Categorias 010_SP_Catalogo 011_SP_Inventario
  013_Migracion_CarritoCupon 014_SP_Cupones 012_SP_Carrito
  015_Catalogo_EstadosPedido 017_Migracion_CarritoTokenUnico
  019_Bitacora 020_Reportes 021_SP_Catalogo_Publico
  # 022 agrega NombreFactura/NITFactura a dbo.Pedido; 016 y 018 referencian esas
  # columnas, por eso se aplican DESPUES de 022 (como 012 va despues de 013).
  022_Migracion_PedidoFacturacion 016_SP_Checkout 018_SP_Pedidos
  # 023 (F2): SPs de solo lectura para "Mis pedidos" del cliente. Despues de 018.
  023_SP_Pedidos_Cliente
  # 024 (F2): perfil/cambio de contrasena y listado admin del catalogo. Despues de 023.
  024_SP_Fase2_Cuenta
  # 026 (F2): operacion de inventario y pedidos del area interna. Al final; solo lee
  # objetos ya creados (VW_Inventario_Disponible, Variante.ImagenURL, Kardex, Pedido).
  026_SP_Fase2_Operacion
)
[[ $SEMILLAS -eq 1 ]] && ORDEN+=(099_Semillas)

if [[ -n "$USER" ]]; then AUTH=(-U "$USER" -P "$PASSWORD"); else AUTH=(-E); fi

for base in "${ORDEN[@]}"; do
  echo "==> ${base}.sql"
  if ! "$SQLCMD" -S "$SERVER" "${AUTH[@]}" -C -b -i "$DIR/${base}.sql"; then
    echo "Fallo al aplicar ${base}.sql. Se detiene la instalacion." >&2
    exit 1
  fi
done

# Clave de aplicacion para produccion: 003 crea shopcart_app con una clave fija de
# desarrollo; aqui se cambia por la real. El valor va como variable sqlcmd (-v), no
# concatenado en el texto. (La clave no debe contener comillas simples.)
if [[ -n "$APP_PASSWORD" ]]; then
  echo "==> ALTER LOGIN shopcart_app (clave de aplicacion)"
  if ! "$SQLCMD" -S "$SERVER" "${AUTH[@]}" -C -b \
        -v AppPassword="$APP_PASSWORD" \
        -Q "ALTER LOGIN shopcart_app WITH PASSWORD = N'\$(AppPassword)';"; then
    echo "Fallo al fijar la clave de shopcart_app. Se detiene." >&2
    exit 1
  fi
fi

echo
echo "== Verificacion =="
"$SQLCMD" -S "$SERVER" "${AUTH[@]}" -C -b -d ShopCart -Q "SET NOCOUNT ON; \
SELECT 'Tablas (se esperan 26)' AS Objeto, COUNT(*) AS Cantidad FROM sys.tables WHERE is_ms_shipped = 0 \
UNION ALL SELECT 'Procedimientos', COUNT(*) FROM sys.procedures \
UNION ALL SELECT 'Triggers', COUNT(*) FROM sys.triggers WHERE is_ms_shipped = 0 \
UNION ALL SELECT 'Vistas', COUNT(*) FROM sys.views \
UNION ALL SELECT 'Login shopcart_app', (SELECT COUNT(*) FROM sys.server_principals WHERE name = 'shopcart_app');"

echo
echo "Instalacion completada."
