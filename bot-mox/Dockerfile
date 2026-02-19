FROM node:20-bookworm AS build
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm run build

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=build /app/dist ./

EXPOSE 80

RUN chmod +x /docker-entrypoint.sh
CMD ["/docker-entrypoint.sh"]
