# Coleccion Postman / newman — ShopCart

`ShopCart.postman_collection.json` cubre la API de Fase 1 (M1–M9) y los bloques de Fase 2
(`00 Recorrido guiado Fase 2`, `F2 Pedidos cliente`, `F2 Cuenta y catalogo admin`,
`F2 Archivos`, `F2 Operacion`, `F2 Control`, `F2 Eventos`, `F2 Dashboard`). Las variables
viven en la coleccion (`baseUrl`, tokens por rol e IDs que los requests capturan solos); no
hace falta un entorno aparte. Ajusta `baseUrl` si la API no corre en `http://localhost:3000`.

## Carpeta `00 Recorrido guiado Fase 2`

Los 15 requests que respaldan por API los recorridos de
[`docs/GUIA-EVALUACION-FASE2.md`](../GUIA-EVALUACION-FASE2.md) (cliente, operador y
administrador): login por rol, perfil, catalogo e inventario **ordenados en el servidor**,
simulacion de ajuste no permitido (RF-03), resumen de operacion, dashboard con `X-Cache`
MISS/HIT y granularidad SEMANA (RF-08), ticket SSE (201 admin / 403 cliente) y el 403 de
bitacora al Operador. Es **solo lectura / idempotente** (el registro usa `{{$guid}}`), asi que
es repetible sin reinstalar la base. Ejecutalo de arriba hacia abajo (los primeros tres fijan
los tokens). No necesita `--working-dir`:

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "00 Recorrido guiado Fase 2" \
  --env-var baseUrl=http://localhost:3000
```

> Esta carpeta se genera con el script de ayuda `docs/postman/build-recorrido-f2.mjs`
> (`node docs/postman/build-recorrido-f2.mjs`), que la inserta o la reemplaza de forma
> idempotente conservando el formato del archivo.

Requisitos: la API arriba, la base sembrada (`db/aplicar.ps1`, incluye `099`) y, para la
coleccion completa, `RATE_LIMIT_*_MAX=100` (los trae `api/.env.example`) para que los
multiples logins no hagan saltar el limitador (`429`).

## Coleccion completa

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --env-var baseUrl=http://localhost:3000
```

## Carpetas de subida de imagenes (`F2 Archivos`)

Estas pruebas suben archivos con `formdata`, por lo que newman debe leer los fixtures desde
`docs/postman/fixtures`: hay que pasar `--working-dir`.

El fixture de 3 MB (`big.bin`) **no esta versionado** (esta en `.gitignore`): se genera al
vuelo antes de correr la carpeta. Los demas fixtures (`valid.png`, `fake.jpg`, `evil.svg`)
si estan en el repo.

Genera `big.bin` (3 MB de ceros; solo importa el tamano, el validador por firma lo rechaza
con `413` antes de mirar el contenido) y corre la carpeta:

```bash
# bash
node -e "require('fs').writeFileSync('docs/postman/fixtures/big.bin', Buffer.alloc(3*1024*1024))"
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "F2 Archivos" \
  --working-dir docs/postman/fixtures \
  --env-var baseUrl=http://localhost:3000
```

```powershell
# PowerShell
$big=Join-Path $PWD 'docs/postman/fixtures/big.bin'; $fs=[IO.File]::Create($big); $fs.SetLength(3MB); $fs.Close()
npx --yes newman run docs/postman/ShopCart.postman_collection.json `
  --folder "F2 Archivos" `
  --working-dir docs/postman/fixtures `
  --env-var baseUrl=http://localhost:3000
```

Al terminar puedes borrar `big.bin`; no debe commitearse.

## Carpeta `F2 Operacion`

Solo lee y simula (no registra movimientos ni cambia estados), asi que es repetible sin
dejar rastro. No necesita `--working-dir`:

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "F2 Operacion" \
  --env-var baseUrl=http://localhost:3000
```

## Carpeta `F2 Control` (F8)

Control del area interna: cupones admin (listado con estado derivado, cada filtro y resumen),
edicion de cupon con usos rechazada (409), bitacora por texto y por registro, usuarios admin,
desbloquear, crear usuario interno (201 con `contrasenaTemporal`) y auto-cambio de rol rechazado
(409 — la regla de M1 responde 409, no 422). Trae su propio login de admin (setup) y crea un
operador con correo `op-{{$guid}}` (no colisiona en reejecuciones). No necesita `--working-dir`:

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "F2 Control" \
  --env-var baseUrl=http://localhost:3000
```

## Carpeta `F2 Eventos` (F9)

Ciclo del ticket SSE: admin obtiene ticket (201), un cliente no puede (403), y un ticket
invalido/vencido/reutilizado al abrir el stream da 401 (todos caen en la misma rama, porque
el ticket se consume al usarse). El stream valido abierto, el reuso tras consumir y la llegada
del evento `pedido.creado` en menos de 2 s se prueban en `api/tests/sse.mjs` (newman no puede
sostener un `text/event-stream` abierto). No necesita `--working-dir`:

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "F2 Eventos" \
  --env-var baseUrl=http://localhost:3000

node api/tests/sse.mjs   # flujo completo del stream (abre SSE, compra y verifica pedido.creado)
```

## Carpeta `F2 Dashboard` (F9)

Datos del dashboard del area interna: resumen con los 4 KPIs y su comparativo, serie diaria
con ceros, categorias con porcentaje, embudo con tasas, horas pico y cupones del periodo.
Verifica `X-Cache` MISS en la primera lectura y HIT en la segunda, que el Operador tambien
lee el dashboard (200) y que un cliente no (403). Solo lee; es repetible. No necesita
`--working-dir`:

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "F2 Dashboard" \
  --env-var baseUrl=http://localhost:3000
```
