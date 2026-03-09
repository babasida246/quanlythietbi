#!/bin/bash
# ==============================================================================
# API Entrypoint Script
# Chạy migrations nếu cần thiết, sau đó khởi động API server.
#
# Biến môi trường điều khiển:
#   RUN_MIGRATIONS=true|false  (mặc định: true)
#   DATABASE_URL               (bắt buộc)
# ==============================================================================
set -e

# ── Kiểm tra DATABASE_URL ──────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌  DATABASE_URL is required"
    exit 1
fi

# ── Chờ PostgreSQL sẵn sàng ────────────────────────────────────────────────
echo "⏳  Waiting for PostgreSQL..."
MAX_WAIT=60
ELAPSED=0

# Trích host/port từ DATABASE_URL  (postgresql://user:pass@host:port/db)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_PORT="${DB_PORT:-5432}"

until (echo > /dev/tcp/"$DB_HOST"/"$DB_PORT") 2>/dev/null; do
    if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
        echo "❌  PostgreSQL not ready after ${MAX_WAIT}s — aborting"
        exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done
echo "✅  PostgreSQL ready (${DB_HOST}:${DB_PORT})"

# ── Chờ Redis nếu được cấu hình ───────────────────────────────────────────
if [ "${REDIS_CACHE_ENABLED:-true}" = "true" ] && [ -n "${REDIS_URL:-}" ]; then
    REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|.*@([^:/]+):.*|\1|; s|redis://([^:/]+):.*|\1|')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|.*:([0-9]+)$|\1|')
    REDIS_PORT="${REDIS_PORT:-6379}"
    echo "⏳  Waiting for Redis (${REDIS_HOST}:${REDIS_PORT})..."
    RED_WAIT=30
    RED_ELAPSED=0
    until (echo > /dev/tcp/"$REDIS_HOST"/"$REDIS_PORT") 2>/dev/null; do
        if [ "$RED_ELAPSED" -ge "$RED_WAIT" ]; then
            echo "⚠️   Redis not reachable after ${RED_WAIT}s — continuing without Redis (in-memory fallback)"
            break
        fi
        sleep 2
        RED_ELAPSED=$((RED_ELAPSED + 2))
    done
    if (echo > /dev/tcp/"$REDIS_HOST"/"$REDIS_PORT") 2>/dev/null; then
        echo "✅  Redis ready"
    fi
fi

# ── Chạy migrations ───────────────────────────────────────────────────────
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "🔄  Running database migrations..."
    node /app/scripts/db-migrate.mjs
    echo "✅  Migrations complete"
else
    echo "⏭️   Skipping migrations (RUN_MIGRATIONS=false)"
fi

# ── Khởi động API ─────────────────────────────────────────────────────────
echo "🚀  Starting API server..."
exec node apps/api/dist/apps/api/src/main.js
