# ── Stage 1: build React app ──────────────────────────────────────── #
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve via nginx ──────────────────────────────────────── #
FROM nginx:1.27-alpine AS runtime

# Konfiguracja nginx: SPA fallback + proxy do API
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
