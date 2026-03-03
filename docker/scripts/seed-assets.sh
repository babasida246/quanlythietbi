#!/usr/bin/env sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for seed."
  exit 1
fi

if [ "${ASSETS_DB_SEED:-true}" = "false" ]; then
  echo "ASSETS_DB_SEED=false, skipping seed."
  exit 0
fi

seed_runner="/app/packages/infra-postgres/src/seeds/deterministic-seed.mjs"
if [ -f "$seed_runner" ]; then
  echo "Seeding assets data with deterministic runner..."
  node "$seed_runner"
else
  echo "Seed runner not found: $seed_runner"
  exit 1
fi

echo "Assets seed complete."
