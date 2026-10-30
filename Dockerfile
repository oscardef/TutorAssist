# Mathium web + worker image. One image, two commands:
#   web:    node server.js            (Next.js standalone build)
#   worker: node node_modules/.bin/tsx src/worker.ts
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public env is baked in at build time; everything else is read at runtime.
ARG NEXT_PUBLIC_APP_URL=https://mathium.app
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r app && useradd -r -g app -d /app app
# Standalone server for the web process
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Full source + dependencies for the worker and migrations (tsx resolves @/ paths)
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/db ./db
COPY --from=build --chown=app:app /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /data/files && chown -R app:app /data
USER app
EXPOSE 3000
CMD ["node", "server.js"]
