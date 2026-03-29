FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

FROM base AS dev
COPY . .
RUN pnpm install
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-slim AS prod
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
RUN addgroup --system app && adduser --system --ingroup app app

COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma/ ./prisma/
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile && npm uninstall -g pnpm

COPY --from=build /app/dist ./dist

RUN chown app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "dist/src/index.js"]
