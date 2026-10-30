#!/usr/bin/env bash
# Nightly Mathium backup on m70q: pg_dump (custom format) + rsync of uploaded files.
# Keeps 14 daily dumps. Install: crontab -e ->  15 3 * * * /opt/stacks/mathium/backup.sh
set -euo pipefail
STACK=/opt/stacks/mathium
DEST=/srv/storage/backups/server/mathium
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$DEST/db" "$DEST/files"
cd "$STACK"
docker compose exec -T db pg_dump -U postgres -d mathium -Fc --no-owner --no-privileges > "$DEST/db/mathium-$STAMP.dump"
chmod 600 "$DEST/db/mathium-$STAMP.dump"
rsync -a --delete /srv/appdata/mathium/files/ "$DEST/files/"
ls -1t "$DEST/db"/mathium-*.dump | tail -n +15 | xargs -r rm -f
echo "$(date -u +%FT%TZ) backup ok $STAMP" >> "$DEST/backup.log"
