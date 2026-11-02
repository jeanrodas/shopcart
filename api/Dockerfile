# ============================================================
# ShopCart API - imagen multi-stage.
# Build: compila TypeScript a dist/. Runtime: solo dependencias de produccion.
# ============================================================

# ---- Etapa build: compila con las dependencias completas ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Etapa runtime: imagen final minima ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Solo dependencias de produccion.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Artefactos compilados.
COPY --from=build /app/dist ./dist

# Ejecuta como usuario no root (el usuario 'node' ya existe en la imagen oficial).
USER node

EXPOSE 3000

# wget viene en busybox (node:alpine); consulta el /health de la propia API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

CMD ["node", "dist/server.js"]
