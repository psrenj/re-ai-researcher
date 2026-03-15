FROM node:24.13-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./

RUN npm ci
RUN npm run build -w @re-ai/api

FROM node:24.13-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN mkdir -p /app/data

WORKDIR /app/apps/api
EXPOSE 8787

CMD ["node", "dist/index.js"]
