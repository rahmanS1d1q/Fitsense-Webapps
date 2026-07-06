# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ---- Stage 2: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pastikan folder public ada (Next.js membutuhkan ini)
RUN mkdir -p ./public

# Build Next.js — NEXT_PUBLIC_* harus di-pass sebagai build args
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MQTT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MQTT_URL=$NEXT_PUBLIC_MQTT_URL

RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Salin standalone output (berisi server.js + node_modules minimal)
COPY --from=builder /app/.next/standalone ./

# Salin static assets
COPY --from=builder /app/.next/static ./.next/static

# Salin public folder
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
