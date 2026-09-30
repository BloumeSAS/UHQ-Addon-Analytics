# ═══════════════════════════════════════════════════════════════════════════════
# UHQ Analytics Addon — Dockerfile
# Build multi-stage : web (React/Vite) → api (NestJS) → runner
#
# Compatible Coolify / Docker Compose. L'addon est sans état (aucune base) :
# pas de volume nécessaire. Port exposé : 3001
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1 : Build React ────────────────────────────────────────────────────
FROM node:20-alpine AS web-builder
WORKDIR /build/web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY web/ ./
RUN npm run build

# ── Stage 2 : Build NestJS ───────────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /build/api
COPY api/package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY api/ ./
RUN npm run build
RUN npm prune --production --legacy-peer-deps

# ── Stage 3 : Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=api-builder /build/api/dist        ./api/dist
COPY --from=api-builder /build/api/node_modules ./api/node_modules
COPY --from=web-builder /build/web/dist        ./web/dist
COPY uhq-manifest.json ./

# Processus non-root (l'addon n'écrit rien sur disque).
USER node

EXPOSE 3001

ENV NODE_ENV=production \
    PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/uhq-manifest.json | grep -q '"name"' || exit 1

CMD ["node", "api/dist/main"]
