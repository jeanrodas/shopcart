# Despliegue de ShopCart (Docker Compose + Caddy)

Levanta ShopCart en un VPS Ubuntu con **SQL Server 2022**, la **API** Node y **Caddy**
(HTTPS automatico via Let's Encrypt) en `jeanrodas.lat`. La base se instala con el
instalador real `db/aplicar.sh` dentro del contenedor de SQL Server.

Requisitos del servidor: Docker 29 + Compose v5, >= 4 GB RAM (+2 GB swap recomendado),
DNS del dominio apuntando a la IP del VPS, y el firewall abriendo solo 22/80/443.

Arquitectura: solo **Caddy** publica puertos (80/443). La **API** y **SQL Server** viven
en la red interna de compose; SQL Server no tiene puerto publico.

## Primera instalacion

```bash
# 1. Clonar en el servidor
git clone <url-del-repo> shopcart
cd shopcart/deploy

# 2. Configurar variables (copiar y rellenar)
cp .env.example .env
# Genere los secretos:  openssl rand -hex 32   (para JWT_ACCESS_SECRET y JWT_REFRESH_SECRET)
# Ponga claves fuertes en MSSQL_SA_PASSWORD y DB_PASSWORD, y su correo en CADDY_EMAIL.
nano .env

# 3. Levantar SOLO la base y esperar a que quede "healthy"
docker compose up -d sqlserver
docker compose ps                      # repetir hasta ver sqlserver (healthy)
# o:  docker inspect --format '{{.State.Health.Status}}' $(docker compose ps -q sqlserver)

# 4. Instalar la base (copia db/ al contenedor y corre db/aplicar.sh)
./instalar-bd.sh
# Imprime los 21 scripts, los conteos de verificacion (26 tablas, etc.) y
# "Instalacion completada". Fija la clave de shopcart_app = DB_PASSWORD.

# 5. Construir y levantar la API + Caddy
docker compose up -d --build

# 6. Verificar (Caddy emite el certificado en el primer acceso; puede tardar unos segundos)
curl https://jeanrodas.lat/health      # -> {"status":"ok","db":"ok",...}
```

> **Avisos esperados de la instalacion** (no son errores): al aplicar `014` SQL Server
> advierte sobre `dbo.SP_Carrito_Obtener` (se crea en `012`, despues, por el orden
> canonico), y `099` imprime varios result sets al generar los pedidos demo. Ver
> `db/README.md`.

## Operacion

```bash
# Logs
docker compose logs -f api
docker compose logs -f caddy
docker compose ps

# Reiniciar la API
docker compose restart api

# Apagar / encender
docker compose down          # conserva volumenes (datos de SQL y certificados)
docker compose up -d
```

## Actualizar a una version nueva

```bash
cd shopcart
git pull
cd deploy
docker compose up -d --build          # reconstruye la imagen de la API y recrea lo cambiado
# Si hay scripts SQL nuevos, reaplicar (idempotentes, salvo 001):
./instalar-bd.sh
```

## Respaldo del volumen de SQL Server

El volumen `shopcart_mssql_data` contiene los datos. Respaldo en caliente a un `.tar.gz`:

```bash
docker run --rm \
  -v shopcart_mssql_data:/var/opt/mssql \
  -v "$PWD":/backup \
  alpine tar czf /backup/mssql-$(date +%F).tar.gz -C /var/opt/mssql .
```

Restauracion (con la base detenida): `docker compose stop sqlserver`, borrar/crear el
volumen y extraer el tar dentro de `/var/opt/mssql`, luego `docker compose up -d sqlserver`.
Alternativa recomendable para produccion: BACKUP/RESTORE nativo de SQL Server a un `.bak`.

## Ambiente de demostracion (pago simulado)

No existe una variable `DEMO`. El pago simulado se gobierna por **dos** variables de la
API: `NODE_ENV` y `PAGO_SIMULADO`. En produccion (`NODE_ENV=production`) la app **no
arranca** si `PAGO_SIMULADO=true` (es una salvaguarda deliberada). Para un ambiente de
**demo** donde el cliente pueda elegir el desenlace del pago, en el `.env` del servidor
de demo poner:

```ini
NODE_ENV=development
PAGO_SIMULADO=true
```

y `docker compose up -d --build`. Con esto `simularResultado` del cuerpo decide el pago;
con `PAGO_SIMULADO=false` el backend siempre cobra APROBADO e ignora ese campo. Nunca usar
esta combinacion en el ambiente real.

## Seguridad

- **SQL Server sin puerto publico**: solo accesible en la red interna de compose; el
  unico ingreso externo es Caddy (80/443).
- **Firewall del VPS (Hetzner Cloud Firewall o `ufw`)**: permitir solo 22 (SSH), 80 y 443.
- **Secretos solo en `deploy/.env` del servidor** (no se versiona; `.env.example` es la
  plantilla). Rotar `MSSQL_SA_PASSWORD`, `DB_PASSWORD` y los secretos JWT periodicamente.
- `TRUST_PROXY=1`: la API confia en un unico salto de proxy (Caddy) para derivar la IP
  real del cliente (rate limiting correcto).
