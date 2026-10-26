# syntax=docker/dockerfile:1
# Production image for the admin + staff portal (Next.js standalone).
# Build:  docker build --build-arg NEXT_PUBLIC_API_URL=https://api.<domain>/api -t g2h-admin .
# Run:    docker run -p 3000:3000 g2h-admin
#
# Note: tsconfig.json extends ../constDocManagment/tsconfig.base.json, but next build does
# not require type-checking against it at runtime; the standalone output is self-contained.

# ---- deps ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# tsconfig.json extends ../constDocManagment/tsconfig.base.json — a sibling repo that is
# not in this (admin-only) build context. Vendor a minimal equivalent at the expected
# relative path so the standalone build is self-contained. Local dev still uses the real
# sibling base; admin's own tsconfig overrides every option here except casing checks.
RUN mkdir -p /constDocManagment && \
    printf '%s' '{"compilerOptions":{"target":"ES2022","module":"CommonJS","moduleResolution":"Node","strict":true,"esModuleInterop":true,"forceConsistentCasingInFileNames":true,"skipLibCheck":true,"baseUrl":"."}}' \
    > /constDocManagment/tsconfig.base.json
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=https://api.example.com/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
