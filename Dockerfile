FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
COPY . .

FROM base AS dev
RUN pnpm install
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM base AS build
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS prod
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/generated ./generated
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["pnpm", "start"]
