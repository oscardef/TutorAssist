# Deploying Mathium on m70q

Stack directory: `/opt/stacks/mathium` (`docker-compose.yml`, `.env` mode 0600, `backup.sh`).
State: `/srv/appdata/mathium/postgres` (database), `/srv/appdata/mathium/files` (uploads),
`/srv/appdata/mathium/build` (source copy used for the image build).
Backups: `/srv/storage/backups/server/mathium/` (nightly, see `backup.sh`).

## Services

| Service | Image | Purpose |
|---|---|---|
| db | pgvector/pgvector:pg17 | Postgres with pgvector; identity, application data |
| postgrest | postgrest/postgrest:v16.5 | Data API; enforces RLS with JWTs minted by the app |
| web | mathium:latest | Next.js server (`node server.js`), port 3000 → `${BIND_ADDRESS}:${WEB_PORT}` |
| worker | mathium:latest | Job worker (`tsx src/worker.ts`) |

## First deployment

```bash
# on the Mac: sync source, then build on the server
rsync -a --delete --exclude node_modules --exclude .next --exclude .git --exclude .data --exclude '.env*' ./ m70q:/srv/appdata/mathium/build/
ssh m70q 'cd /srv/appdata/mathium/build && docker build --build-arg NEXT_PUBLIC_APP_URL=https://mathium.app -t mathium:latest .'

# on m70q
cd /opt/stacks/mathium
docker compose up -d db
docker compose exec -T db pg_restore -U postgres -d mathium --no-owner --no-privileges < /path/to/dump   # first time only
docker compose run --rm web node node_modules/.bin/tsx scripts/db-migrate.ts
docker compose exec -T db psql -U postgres -d mathium -c "ALTER ROLE authenticator PASSWORD '<AUTHENTICATOR_PASSWORD from .env>'"
docker compose up -d
curl -s http://100.88.107.120:3100/api/auth/status
```

## Updating

```bash
rsync ... (as above)
ssh m70q 'cd /srv/appdata/mathium/build && docker build --build-arg NEXT_PUBLIC_APP_URL=https://mathium.app -t mathium:latest . && cd /opt/stacks/mathium && docker compose run --rm web node node_modules/.bin/tsx scripts/db-migrate.ts && docker compose up -d web worker'
```

Migrations live in `db/migrations/*.sql` and are applied in order; applied names are recorded in `public.schema_migrations`.

## Going public

Requires, in this order: the server security review (hub: Home Server/Access and Security), rotating
every secret that ever lived in a laptop `.env.local`, a DNS record for `mathium.app` pointing at the
server, a Caddy site block (`reverse_proxy 127.0.0.1:3100`) with `BIND_ADDRESS=127.0.0.1`, and a rebuild
with `NEXT_PUBLIC_APP_URL=https://mathium.app` plus `BETTER_AUTH_URL`/`GOOGLE_OAUTH_REDIRECT_URI` updated in `.env`.
