#!/usr/bin/env bash
# Switch the m70q stack from tailnet staging to https://mathium.app.
# Run on m70q from /opt/stacks/mathium AFTER the DNS record and the Caddy
# site are in place:  bash /srv/appdata/mathium/build/deploy/go-live.sh
# Idempotent. Never prints secret values. Backs up .env first.
set -euo pipefail
cd /opt/stacks/mathium
ORIGIN="${ORIGIN:-https://mathium.app}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP=/srv/storage/backups/server/mathium/env-$TS
mkdir -p "$BACKUP" && cp .env "$BACKUP/.env" && chmod 600 "$BACKUP/.env"
echo "backed up .env to $BACKUP"

set_key() { # set_key NAME VALUE  (adds or replaces, value never echoed)
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf '%s=%s\n' "$1" "$2" >> .env; fi
}
set_key NEXT_PUBLIC_APP_URL "$ORIGIN"
set_key BETTER_AUTH_URL "$ORIGIN"
set_key GOOGLE_OAUTH_REDIRECT_URI "$ORIGIN/api/auth/google/callback"
if [ "${ROTATE_SECRETS:-yes}" = "yes" ]; then
  # Fresh signing secrets for production: everyone signs in again once
  set_key BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  set_key PGRST_JWT_SECRET "$(openssl rand -hex 32)"
  echo "rotated BETTER_AUTH_SECRET and PGRST_JWT_SECRET"
fi
chmod 600 .env

docker build --build-arg NEXT_PUBLIC_APP_URL="$ORIGIN" -t mathium:latest /srv/appdata/mathium/build > /srv/appdata/mathium/build.log 2>&1
docker compose up -d --force-recreate postgrest web worker
sleep 15
docker compose ps --format '{{.Service}} {{.Status}}'
curl -s -o /dev/null -w "local check /login: %{http_code}\n" http://127.0.0.1:${PUBLIC_PORT:-3110}/login
curl -s -o /dev/null -w "public check $ORIGIN/login: %{http_code}\n" "$ORIGIN/login" || true
