#!/usr/bin/env bash
# ============================================================
# Reinstala la base ShopCart desde cero: la BORRA (si existe) y vuelve a aplicar aplicar.sh.
# Pide confirmacion salvo --force. Deja SEMILLAS FRESCAS (para la suite de pruebas).
#
# Uso:
#   ./reinstalar.sh --force
#   ./reinstalar.sh -s localhost -u sa -p 'SaPass!' --force
# Opciones: -s/--server, -u/--user, -p/--password, -f/--force
# ============================================================
set -euo pipefail

SERVER="localhost"
USER=""
PASSWORD=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--server)   SERVER="$2"; shift 2 ;;
    -u|--user)     USER="$2"; shift 2 ;;
    -p|--password) PASSWORD="$2"; shift 2 ;;
    -f|--force)    FORCE=1; shift ;;
    *) echo "Argumento desconocido: $1" >&2; exit 2 ;;
  esac
done

if [[ $FORCE -ne 1 ]]; then
  echo "Esto BORRARA por completo la base 'ShopCart' en $SERVER y la reinstalara desde cero."
  read -r -p "Escriba 'si' para continuar: " resp
  [[ "$resp" == "si" ]] || { echo "Cancelado."; exit 1; }
fi

SQLCMD="$(command -v sqlcmd || true)"
if [[ -z "$SQLCMD" ]]; then
  if [[ -x /opt/mssql-tools18/bin/sqlcmd ]]; then SQLCMD=/opt/mssql-tools18/bin/sqlcmd
  elif [[ -x /opt/mssql-tools/bin/sqlcmd ]]; then SQLCMD=/opt/mssql-tools/bin/sqlcmd
  else echo "No se encontro sqlcmd." >&2; exit 3; fi
fi

if [[ -n "$USER" ]]; then AUTH=(-U "$USER" -P "$PASSWORD"); else AUTH=(-E); fi

echo "==> DROP DATABASE ShopCart (si existe)"
"$SQLCMD" -S "$SERVER" "${AUTH[@]}" -C -b -Q "IF DB_ID('ShopCart') IS NOT NULL BEGIN ALTER DATABASE ShopCart SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ShopCart; END"

DIR="$(cd "$(dirname "$0")" && pwd)"
APLICAR_ARGS=(-s "$SERVER")
[[ -n "$USER" ]] && APLICAR_ARGS+=(-u "$USER" -p "$PASSWORD")
exec "$DIR/aplicar.sh" "${APLICAR_ARGS[@]}"
