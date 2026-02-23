FROM node:20-bookworm AS build
WORKDIR /workspace

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @botmox/admin build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/admin/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /workspace/apps/admin/dist ./

EXPOSE 80

RUN chmod +x /docker-entrypoint.sh
CMD ["/docker-entrypoint.sh"]
