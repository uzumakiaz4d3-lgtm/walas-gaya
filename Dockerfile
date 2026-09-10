# syntax=docker/dockerfile:1

########## BASE ##########
FROM node:24-alpine AS base
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

########## DEPENDENCIES ##########
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

########## BUILD + TEST ##########
FROM base AS builder
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variabel NEXT_PUBLIC_* dibangun ke bundle → via ARG (default dari .env.example)
ARG NEXT_PUBLIC_APP_NAME="WaliKelas"
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/walikelas?schema=public" \
    DIRECT_URL="postgresql://postgres:postgres@localhost:5432/walikelas?schema=public" \
    AUTH_SECRET="change-this-secret-key"

RUN npm run build
# Smoke test: pastikan env terbaca & endpoint API berfungsi (gagal = build gagal)
RUN npm test

########## RUNTIME ##########
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat

# Hanya artefak yang diperlukan (output standalone)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# Jalankan sebagai user non-root; pastikan data/ dapat ditulis (API admin)
RUN chown -R node:node /app/data

USER node
EXPOSE 3000

CMD ["node", "server.js"]