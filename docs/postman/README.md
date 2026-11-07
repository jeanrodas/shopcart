# Coleccion Postman / newman — ShopCart

`ShopCart.postman_collection.json` cubre la API de Fase 1 (M1–M9) y los bloques de Fase 2
(`F2 Pedidos cliente`, `F2 Cuenta y catalogo admin`, `F2 Archivos`, `F2 Operacion`). Las
variables viven en la coleccion (`baseUrl`, tokens por rol e IDs que los requests capturan
solos); no hace falta un entorno aparte. Ajusta `baseUrl` si la API no corre en
`http://localhost:3000`.

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
$fs=[IO.File]::Create("docs/postman/fixtures/big.bin"); $fs.SetLength(3MB); $fs.Close()
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
