#!/usr/bin/env bash
# ============================================================
# Instala la base ShopCart DENTRO del contenedor sqlserver, probando el instalador
# real db/aplicar.sh. Copia db/ al contenedor (docker cp) y ejecuta aplicar.sh con el
# usuario sa y fijando la clave del login shopcart_app (AppPassword = DB_PASSWORD).
#
# Prerrequisito: el servicio sqlserver debe estar "healthy"
#   docker compose up -d sqlserver   &&   (esperar a que quede healthy)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="./.env"
[[ -f "$ENV_FILE" ]] || { echo "Falta $ENV_FILE (copie .env.example a .env)." >&2; exit 1; }

# Toma solo las dos claves que se necesitan, sin 'source' (evita evaluar valores).
valor() { grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2-; }
MSSQL_SA_PASSWORD="$(valor MSSQL_SA_PASSWORD)"
DB_PASSWORD="$(valor DB_PASSWORD)"
: "${MSSQL_SA_PASSWORD:?falta MSSQL_SA_PASSWORD en .env}"
: "${DB_PASSWORD:?falta DB_PASSWORD en .env}"

CID="$(docker compose -f docker-compose.yml ps -q sqlserver)"
[[ -n "$CID" ]] || { echo "El contenedor sqlserver no esta corriendo. Ejecuta: docker compose up -d sqlserver" >&2; exit 1; }

echo "== Copiando db/ al contenedor =="
docker cp ../db "$CID:/tmp/db"

echo "== Aplicando db/aplicar.sh dentro del contenedor (sa + AppPassword) =="
docker exec "$CID" bash /tmp/db/aplicar.sh \
  -s localhost -u sa -p "$MSSQL_SA_PASSWORD" -a "$DB_PASSWORD"

echo "== Limpieza =="
# docker cp deja /tmp/db como root, pero el contenedor corre como el usuario mssql:
# borrar como root.
docker exec -u root "$CID" rm -rf /tmp/db

echo "Base de datos instalada. El login shopcart_app quedo con la clave DB_PASSWORD."
