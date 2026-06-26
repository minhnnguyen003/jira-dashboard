# Use --build-arg ENV_ENV=local|prod|runtime to select build-time env input.
# `local` and `prod` load the matching env file during `next build` so
# `NEXT_PUBLIC_*` values can be baked into the standalone bundle.
# `runtime` skips copying env files and expects values from `docker run` /
# `docker compose`.
ARG ENV_ENV=runtime

# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./

RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder

WORKDIR /app
ARG ENV_ENV=runtime

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN case "${ENV_ENV}" in \
      local|prod|runtime) ;; \
      *) echo "ERROR: ENV_ENV must be 'local', 'prod', or 'runtime'" >&2; exit 1 ;; \
    esac

# Copy the selected env file for build-time NEXT_ vars
RUN if [ "${ENV_ENV}" = "local" ]; then \
      cp .env.local .env ; \
    elif [ "${ENV_ENV}" = "prod" ]; then \
      cp .env.prod .env ; \
    fi

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner

WORKDIR /app
ARG ENV_ENV=runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
