FROM node:20-bookworm-slim AS deps
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
