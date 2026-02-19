FROM node:20-bookworm AS build
WORKDIR /workspace

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @botmox/frontend build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/frontend/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /workspace/apps/frontend/dist ./

EXPOSE 80

RUN chmod +x /docker-entrypoint.sh
CMD ["/docker-entrypoint.sh"]
