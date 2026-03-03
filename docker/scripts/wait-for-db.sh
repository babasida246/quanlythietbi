#!/usr/bin/env sh
set -e

host="${ASSETS_DB_HOST:-db}"
port="${ASSETS_DB_PORT:-5432}"
user="${ASSETS_DB_USER:-qltb}"
dbname="${ASSETS_DB_NAME:-qltb_assets}"
wait_seconds="${ASSETS_DB_WAIT_TIMEOUT:-60}"

elapsed=0
while [ "$elapsed" -lt "$wait_seconds" ]; do
  if pg_isready -h "$host" -p "$port" -U "$user" -d "$dbname" > /dev/null 2>&1; then
    echo "Database is ready."
    exit 0
  fi
  elapsed=$((elapsed + 1))
  sleep 1
done

echo "Database not ready after ${wait_seconds}s."
exit 1
