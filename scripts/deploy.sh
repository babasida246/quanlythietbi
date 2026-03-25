#!/usr/bin/env bash
# ==============================================================================
# deploy.sh — Install & Build toàn bộ project lên Production Server
#
# Chạy trên máy chủ sau khi đã git pull source code mới.
# Thứ tự build tuân thủ Clean Architecture dependency graph:
#   domain → contracts → infra-postgres → application → api → web-ui
#
# Usage:
#   bash scripts/deploy.sh [OPTIONS]
#
# Options:
#   --migrate     Chạy DB migrations sau build
#   --seed        Chạy DB seed sau migrations (chỉ dùng lần đầu setup)
#   --skip-web    Chỉ build API, bỏ qua web-ui
#   --no-install  Bỏ qua bước pnpm install
#   --clean       Xóa toàn bộ dist/ trước khi build
#   --restart     Restart systemd services (qltb-api, qltb-web) sau khi build xong
#   -h, --help    Hiển thị help
#
# Requirements:
#   - Node.js >= 20
#   - pnpm  >= 8  (hoặc cài tự động qua corepack)
#   - File .env  (copy từ .env.example rồi điền DATABASE_URL, JWT_*, VITE_API_BASE)
# ==============================================================================
set -euo pipefail

# ── Màu sắc terminal ──────────────────────────────────────────────────────────
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';  BOLD='\033[1m'; RESET='\033[0m'

log_step()  { echo -e "\n${BOLD}${BLUE}▶ $*${RESET}"; }
log_ok()    { echo -e "${GREEN}  ✓ $*${RESET}"; }
log_warn()  { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
log_error() { echo -e "${RED}  ✗ $*${RESET}" >&2; }
log_info()  { echo -e "${CYAN}  → $*${RESET}"; }
hr()        { echo -e "${BLUE}══════════════════════════════════════════════════${RESET}"; }

# ── Tìm thư mục gốc repo ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Thời gian bắt đầu ────────────────────────────────────────────────────────
START_TS=$(date +%s)

# ── Parse arguments ──────────────────────────────────────────────────────────
OPT_MIGRATE=false
OPT_SEED=false
OPT_SKIP_WEB=false
OPT_NO_INSTALL=false
OPT_CLEAN=false
OPT_RESTART=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrate)    OPT_MIGRATE=true ;;
    --seed)       OPT_SEED=true; OPT_MIGRATE=true ;;
    --skip-web)   OPT_SKIP_WEB=true ;;
    --no-install) OPT_NO_INSTALL=true ;;
    --clean)      OPT_CLEAN=true ;;
    --restart)    OPT_RESTART=true ;;
    -h|--help)
      sed -n '3,26p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# ── Banner ────────────────────────────────────────────────────────────────────
hr
echo -e "${BOLD}  QLTB — Production Deploy Script${RESET}"
echo -e "  Root: ${CYAN}${ROOT}${RESET}"
echo -e "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "  Options:"
echo -e "    migrate    = ${OPT_MIGRATE}"
echo -e "    seed       = ${OPT_SEED}"
echo -e "    skip-web   = ${OPT_SKIP_WEB}"
echo -e "    no-install = ${OPT_NO_INSTALL}"
echo -e "    clean      = ${OPT_CLEAN}"
hr

cd "$ROOT"

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 1 — Kiểm tra prerequisites
# ══════════════════════════════════════════════════════════════════════════════
log_step "Kiểm tra môi trường"

# Node.js
if ! command -v node &>/dev/null; then
  log_error "Node.js chưa được cài đặt. Cần Node.js >= 20."
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  log_error "Node.js $NODE_VER quá cũ. Cần >= 20.0.0"
  exit 1
fi
log_ok "Node.js $NODE_VER"

# pnpm — thử cài qua corepack nếu thiếu
if ! command -v pnpm &>/dev/null; then
  log_warn "pnpm chưa có — thử cài qua corepack..."
  if command -v corepack &>/dev/null; then
    corepack enable && corepack prepare pnpm@latest --activate
  else
    npm install -g pnpm
  fi
fi
PNPM_VER=$(pnpm --version 2>/dev/null || echo "unknown")
log_ok "pnpm $PNPM_VER"

# .env
if [[ ! -f "$ROOT/.env" ]]; then
  log_error ".env không tồn tại. Hãy copy .env.example → .env và điền DATABASE_URL (hoặc POSTGRES_*), JWT_*, VITE_API_BASE."
  exit 1
fi
log_ok ".env tìm thấy"

# Kiểm tra biến thiết yếu
# shellcheck source=/dev/null
set -a; source "$ROOT/.env"; set +a

# Build DATABASE_URL từ POSTGRES_* nếu chưa có
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -z "${POSTGRES_HOST:-}" ]]; then
    log_error "Phải đặt DATABASE_URL hoặc POSTGRES_HOST trong .env"
    exit 1
  fi
  _pg_user="${POSTGRES_USER:-postgres}"
  _pg_pass="${POSTGRES_PASSWORD:-postgres}"
  _pg_host="${POSTGRES_HOST:-localhost}"
  _pg_port="${POSTGRES_PORT:-5432}"
  _pg_db="${POSTGRES_DB:-qltb}"
  # URL-encode password (xử lý @, #, $ và ký tự đặc biệt khác)
  _pg_pass_enc=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$_pg_pass")
  _pg_user_enc=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$_pg_user")
  DATABASE_URL="postgresql://${_pg_user_enc}:${_pg_pass_enc}@${_pg_host}:${_pg_port}/${_pg_db}"
  export DATABASE_URL
  log_info "DATABASE_URL được tạo từ POSTGRES_* variables"
fi
log_ok "DATABASE_URL: ${DATABASE_URL%%:*}://***@${DATABASE_URL##*@}"

if [[ -z "${VITE_API_BASE:-}" ]]; then
  log_warn "VITE_API_BASE chưa đặt — web-ui sẽ dùng giá trị mặc định (http://localhost:3000/api)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 2 — Clean (tuỳ chọn)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_CLEAN" == "true" ]]; then
  log_step "Xóa build artifacts (--clean)"
  # web-ui dùng adapter-node → output ra build/ (không phải dist/)
  rm -rf "$ROOT/apps/web-ui/build" "$ROOT/apps/web-ui/.svelte-kit"
  # packages và api đều output ra dist/
  # xargs -r: không chạy rm nếu không có input (tránh lỗi khi chưa build lần nào)
  find "$ROOT" \( -path '*/node_modules' -prune \) -o \( -name 'dist' -type d -print \) \
    | xargs -r rm -rf
  find "$ROOT" \( -path '*/node_modules' -prune \) -o \( -name '*.tsbuildinfo' -print \) \
    | xargs -r rm -f
  log_ok "build artifacts đã xóa"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 3 — Install dependencies
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_NO_INSTALL" == "false" ]]; then
  log_step "Cài dependencies (pnpm install)"
  if ! pnpm install --frozen-lockfile; then
    log_error "pnpm-lock.yaml không khớp với package.json"
    log_error "Hãy chạy 'pnpm install' trên máy dev, commit pnpm-lock.yaml, rồi git pull lại."
    log_error "Hoặc chạy 'pnpm install' trực tiếp trên server nếu bạn chủ ý thay đổi dependencies."
    exit 1
  fi
  log_ok "Dependencies đã cài đặt"
else
  log_info "Bỏ qua pnpm install (--no-install)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 4 — Build packages (Clean Architecture order)
# ══════════════════════════════════════════════════════════════════════════════
log_step "Build packages (domain → contracts → infra-postgres → application)"

build_pkg() {
  local pkg="$1"
  local label="$2"
  log_info "Building $label..."
  if ! pnpm --filter "$pkg" build 2>&1 | sed 's/^/    /'; then
    log_error "Build thất bại: $label"
    exit 1
  fi
  log_ok "$label"
}

build_pkg "@qltb/domain"         "packages/domain"
build_pkg "@qltb/contracts"      "packages/contracts"
build_pkg "@qltb/infra-postgres" "packages/infra-postgres"
build_pkg "@qltb/application"    "packages/application"

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 5 — Build API  (tsup — bundles workspace packages vào dist/main.js)
# ══════════════════════════════════════════════════════════════════════════════
log_step "Build API (tsup)"
if ! pnpm --filter "@qltb/api" build 2>&1 | sed 's/^/    /'; then
  log_error "Build API thất bại"
  exit 1
fi
log_ok "apps/api → dist/main.js"

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 6 — Build Web UI (Vite SPA)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_SKIP_WEB" == "false" ]]; then
  log_step "Build Web UI (Vite)"
  if ! pnpm --filter "@qltb/web-ui" build 2>&1 | sed 's/^/    /'; then
    log_error "Build Web UI thất bại"
    exit 1
  fi
  log_ok "apps/web-ui → dist/"
else
  log_info "Bỏ qua build web-ui (--skip-web)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 7 — DB Migrations (tuỳ chọn)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_MIGRATE" == "true" ]]; then
  log_step "Chạy DB Migrations"
  if ! node "$ROOT/scripts/db-migrate.mjs"; then
    log_error "Migration thất bại"
    exit 1
  fi
  log_ok "Migrations hoàn tất"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 8 — DB Seed (tuỳ chọn, chỉ lần đầu)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_SEED" == "true" ]]; then
  log_step "Chạy DB Seed (dữ liệu mẫu ban đầu)"
  if ! node "$ROOT/scripts/db-seed.mjs"; then
    log_error "Seed thất bại"
    exit 1
  fi
  log_ok "Seed hoàn tất"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 9 — Restart systemd services (tuỳ chọn)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_RESTART" == "true" ]]; then
  log_step "Restart systemd services"
  if ! command -v systemctl &>/dev/null; then
    log_warn "systemd không có sẵn — bỏ qua restart"
  else
    if systemctl is-active --quiet qltb-api 2>/dev/null; then
      systemctl restart qltb-api
      log_ok "qltb-api restarted"
    else
      log_warn "qltb-api service chưa được cài đặt — chạy setup-service.sh lần đầu"
    fi
    if [[ "$OPT_SKIP_WEB" == "false" ]]; then
      if systemctl is-active --quiet qltb-web 2>/dev/null; then
        systemctl restart qltb-web
        log_ok "qltb-web restarted"
      else
        log_warn "qltb-web service chưa được cài đặt — chạy setup-service.sh lần đầu"
      fi
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# Tóm tắt
# ══════════════════════════════════════════════════════════════════════════════
END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))
MINS=$((ELAPSED / 60))
SECS=$((ELAPSED % 60))

hr
echo -e "\n${BOLD}${GREEN}  ✅  Deploy thành công! (${MINS}m ${SECS}s)${RESET}\n"

echo -e "  ${BOLD}Artifacts:${RESET}"
echo -e "    API  → ${CYAN}apps/api/dist/main.js${RESET}"
[[ "$OPT_SKIP_WEB" == "false" ]] && \
  echo -e "    Web  → ${CYAN}apps/web-ui/build/${RESET}"

echo ""
echo -e "  ${BOLD}Khởi động API:${RESET}"
echo -e "    ${CYAN}cd apps/api && node dist/main.js${RESET}"
echo -e "    ${CYAN}# hoặc: NODE_ENV=production node apps/api/dist/main.js${RESET}"

echo ""
echo -e "  ${BOLD}Khởi động Web UI (adapter-node):${RESET}"
echo -e "    ${CYAN}PORT=3001 node apps/web-ui/build${RESET}"
echo -e "    ${CYAN}# hoặc: NODE_ENV=production PORT=3001 node apps/web-ui/build${RESET}"

echo ""
hr
