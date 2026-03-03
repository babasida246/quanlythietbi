#!/usr/bin/env sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for migrations."
  exit 1
fi

schema_path="/app/packages/infra-postgres/src/schema.sql"
bundle_path="/app/packages/infra-postgres/src/migrations/assets/000_assets_bundle.sql"

ensure_migration_tracking_table() {
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.setup_migration_runs (
  file_name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied', 'skipped', 'failed')),
  error TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL
}

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

record_migration_run() {
  file_name_escaped=$(sql_escape "$1")
  checksum_escaped=$(sql_escape "$2")
  status_escaped=$(sql_escape "$3")
  error_text=${4:-}
  if [ -n "$error_text" ]; then
    error_sql="'$(sql_escape "$error_text")'"
  else
    error_sql="NULL"
  fi

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    INSERT INTO public.setup_migration_runs (file_name, checksum, status, error, applied_at)
    VALUES ('$file_name_escaped', '$checksum_escaped', '$status_escaped', $error_sql, NOW())
    ON CONFLICT (file_name)
    DO UPDATE SET
      checksum = EXCLUDED.checksum,
      status = EXCLUDED.status,
      error = EXCLUDED.error,
      applied_at = EXCLUDED.applied_at;
  " >/dev/null
}

apply_bundle_incremental() {
  if [ ! -f "$bundle_path" ]; then
    echo "Assets migrations bundle not found: $bundle_path"
    exit 1
  fi

  ensure_migration_tracking_table

  echo "Applying assets migrations bundle incrementally..."
  grep -E '^[[:space:]]*\\i[[:space:]]+' "$bundle_path" | while IFS= read -r include_line; do
    include_path=$(printf "%s" "$include_line" | sed -E 's/^[[:space:]]*\\i[[:space:]]+//')
    include_path=$(printf "%s" "$include_path" | sed -E "s/^['\"]|['\"]$//g")
    include_path=$(printf "%s" "$include_path" | tr -d '\r')

    if [ ! -f "$include_path" ]; then
      echo "Migration file not found: $include_path"
      exit 1
    fi

    checksum=$(sha256sum "$include_path" | awk '{print $1}')
    file_key="$include_path"
    file_key_escaped=$(sql_escape "$file_key")

    existing=$(psql "$DATABASE_URL" -Atc "
      SELECT checksum || '|' || status
      FROM public.setup_migration_runs
      WHERE file_name = '$file_key_escaped'
      LIMIT 1;
    ")

    if [ -n "$existing" ]; then
      existing_checksum=$(printf "%s" "$existing" | cut -d'|' -f1)
      existing_status=$(printf "%s" "$existing" | cut -d'|' -f2)
      if [ "$existing_checksum" = "$checksum" ] && { [ "$existing_status" = "applied" ] || [ "$existing_status" = "skipped" ]; }; then
        echo "SKIP $(basename "$include_path") (already $existing_status)"
        continue
      fi
    fi

    echo "RUN  $(basename "$include_path")"
    output_file=$(mktemp)
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$include_path" >"$output_file" 2>&1; then
      cat "$output_file"
      record_migration_run "$file_key" "$checksum" "applied"
      echo "OK   $(basename "$include_path")"
    else
      cat "$output_file"
      error_text=$(tr '\n' ' ' <"$output_file" | sed 's/[[:space:]]\+/ /g' | cut -c1-2000)

      if grep -qi "is violated by some row" "$output_file"; then
        record_migration_run "$file_key" "$checksum" "skipped" "$error_text"
        rm -f "$output_file"
        echo "SKIP $(basename "$include_path") (existing data check violation)"
        continue
      fi

      record_migration_run "$file_key" "$checksum" "failed" "$error_text"
      rm -f "$output_file"
      echo "FAIL $(basename "$include_path")"
      exit 1
    fi
    rm -f "$output_file"
  done
}

assets_table=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assets' LIMIT 1;")
if [ "$assets_table" != "1" ]; then
  echo "Applying base schema from schema.sql..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$schema_path"
else
  echo "Base schema already present. Skipping schema.sql."
fi

apply_bundle_incremental

echo "Assets migrations complete."
