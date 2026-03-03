#!/usr/bin/env sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for reset."
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

/app/docker/scripts/migrate-assets.sh
/app/docker/scripts/seed-assets.sh
