# The image contains no env files. Pass them at run time:
#   docker run --env-file .env.prod -p 3000:3000 jira-dashboard
#   ENV_FILE=.env.prod docker compose up -d

# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat tzdata

COPY package.json package-lock.json ./

RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=local
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Ho_Chi_Minh

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
