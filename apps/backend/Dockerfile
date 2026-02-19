FROM node:20-bookworm
WORKDIR /workspace

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @botmox/backend build

EXPOSE 3002

CMD ["pnpm", "--filter", "@botmox/backend", "start"]

