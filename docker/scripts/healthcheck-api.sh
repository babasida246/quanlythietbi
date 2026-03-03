#!/usr/bin/env sh
set -e

url="${ASSETS_HEALTHCHECK_URL:-http://localhost:3100/health/ready}"

if command -v curl >/dev/null 2>&1; then
  curl -fsS "$url"
  exit 0
fi

if command -v wget >/dev/null 2>&1; then
  wget --quiet --tries=1 --spider "$url"
  exit 0
fi

echo "No curl/wget available to run healthcheck."
exit 1
