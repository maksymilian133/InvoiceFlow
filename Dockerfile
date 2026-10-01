# ── Stage 1: build ────────────────────────────────────────────────── #
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY erp ./erp

RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────── #
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY public ./public

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
