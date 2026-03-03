#!/usr/bin/env sh
set -e

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"

if [ ! -f .env.assets ]; then
  cp .env.assets.example .env.assets
  echo "Created .env.assets from .env.assets.example"
fi

docker compose -f docker/compose.assets.yml --env-file .env.assets up -d --build

docker compose -f docker/compose.assets.yml --env-file .env.assets exec -T api /app/docker/scripts/migrate-assets.sh

docker compose -f docker/compose.assets.yml --env-file .env.assets exec -T api /app/docker/scripts/seed-assets.sh

docker compose -f docker/compose.assets.yml --env-file .env.assets exec -T api /app/docker/scripts/healthcheck-api.sh || true
