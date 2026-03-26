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
#   --setup-https Cài certbot + plugin nginx, tạo/cập nhật server block, cấp cert
#   --https-staging Dùng Let's Encrypt staging cho --setup-https
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

is_local_domain() {
  local domain="$1"
  local tld=""

  if [[ -z "$domain" ]]; then
    return 0
  fi

  # Common local-only host patterns.
  if [[ "$domain" == "localhost" ]] ||
     [[ "$domain" =~ \.localhost$ ]] ||
     [[ "$domain" =~ \.local$ ]] ||
     [[ "$domain" =~ \.localdomain$ ]] ||
     [[ "$domain" =~ \.internal$ ]] ||
     [[ "$domain" =~ \.test$ ]]; then
    return 0
  fi

  # No dot => not a public FQDN.
  if [[ "$domain" != *.* ]]; then
    return 0
  fi

  tld="${domain##*.}"
  # Public suffix labels are alphabetic; if not, treat as local/private.
  if [[ ! "$tld" =~ ^[A-Za-z]{2,63}$ ]]; then
    return 0
  fi

  return 1
}

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
OPT_SETUP_HTTPS=false
OPT_HTTPS_STAGING=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --migrate)    OPT_MIGRATE=true ;;
    --seed)       OPT_SEED=true; OPT_MIGRATE=true ;;
    --skip-web)   OPT_SKIP_WEB=true ;;
    --no-install) OPT_NO_INSTALL=true ;;
    --clean)      OPT_CLEAN=true ;;
    --setup-https) OPT_SETUP_HTTPS=true ;;
    --https-staging) OPT_HTTPS_STAGING=true; OPT_SETUP_HTTPS=true ;;
    --restart)    OPT_RESTART=true ;;
    --docker-app|--docker-no-build)
      log_error "Tùy chọn $1 không được hỗ trợ trong deploy native Ubuntu (non-Docker)."
      exit 1 ;;
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
echo -e "    setup-https = ${OPT_SETUP_HTTPS}"
echo -e "    https-staging = ${OPT_HTTPS_STAGING}"
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

if [[ -z "${QLTB_DOMAIN:-}" ]]; then
  QLTB_DOMAIN=""
fi
if [[ -z "${LETSENCRYPT_EMAIL:-}" ]]; then
  LETSENCRYPT_EMAIL=""
fi

SUDO=""
if [[ "${EUID}" -ne 0 ]]; then
  if command -v sudo &>/dev/null; then
    SUDO="sudo"
  else
    log_error "Cần quyền root (hoặc cài sudo) để setup HTTPS/nginx/certbot"
    exit 1
  fi
fi

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
# Tự động restart nếu service đang chạy
if command -v systemctl &>/dev/null && systemctl is-active --quiet qltb-api 2>/dev/null; then
  systemctl restart qltb-api && log_ok "qltb-api restarted"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 6 — Build Web UI (Vite SPA)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_SKIP_WEB" == "false" ]]; then
  log_step "Build Web UI (Vite)"
  if ! pnpm --filter "@qltb/web-ui" build 2>&1 | sed 's/^/    /'; then
    log_error "Build Web UI thất bại"
    exit 1
  fi
  log_ok "apps/web-ui → build/"
  # Cấp quyền đọc cho nginx (www-data) khi project nằm trong /home/<user>/
  if [[ -d "$ROOT/apps/web-ui/build/client" ]]; then
    chmod -R o+rX "$ROOT/apps/web-ui/build/client" 2>/dev/null || true
    # Đảm bảo nginx có thể traverse tất cả parent dirs lên tới build/
    _dir="$ROOT"
    while [[ "$_dir" != "/" ]]; do
      chmod o+x "$_dir" 2>/dev/null || true
      _dir="$(dirname "$_dir")"
    done
    log_ok "Quyền đọc build/client — OK"
  fi
  # Tự động restart nếu service đang chạy
  if command -v systemctl &>/dev/null; then
    if systemctl is-active --quiet qltb-web 2>/dev/null; then
      systemctl restart qltb-web && log_ok "qltb-web restarted"
    fi
    if systemctl is-active --quiet nginx 2>/dev/null; then
      systemctl reload nginx && log_ok "nginx reloaded"
    fi
  fi
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
# BƯỚC 9 — Force-start services (--restart: khởi động kể cả khi đang stopped)
# Lưu ý: nếu services đã active, chúng đã được restart tự động sau bước build
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_RESTART" == "true" ]]; then
  log_step "Force-start systemd services (--restart)"
  if ! command -v systemctl &>/dev/null; then
    log_warn "systemd không có sẵn — bỏ qua"
  else
    systemctl start qltb-api  2>/dev/null \
      && log_ok "qltb-api started/running" \
      || log_warn "qltb-api chưa được setup — chạy: sudo bash scripts/setup-service.sh"
    if [[ "$OPT_SKIP_WEB" == "false" ]]; then
      systemctl start qltb-web 2>/dev/null \
        && log_ok "qltb-web started/running" \
        || log_warn "qltb-web chưa được setup — chạy: sudo bash scripts/setup-service.sh"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 10 — HTTPS setup (tuỳ chọn) với nginx + certbot (native Ubuntu)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_SETUP_HTTPS" == "true" ]]; then
  log_step "Setup HTTPS (nginx + certbot)"

  if [[ -z "${QLTB_DOMAIN}" ]]; then
    log_error "Thiếu QLTB_DOMAIN trong .env (ví dụ: qltb.example.com)"
    exit 1
  fi
  if [[ -z "${LETSENCRYPT_EMAIL}" ]]; then
    log_error "Thiếu LETSENCRYPT_EMAIL trong .env"
    exit 1
  fi

  if ! command -v apt-get &>/dev/null; then
    log_error "Script này chỉ hỗ trợ tự động cài certbot trên Ubuntu/Debian (apt-get)."
    exit 1
  fi

  NGINX_SITE_AVAIL="/etc/nginx/sites-available/qltb.conf"
  NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/qltb.conf"

  if [[ ! -L "$NGINX_SITE_ENABLED" ]]; then
    $SUDO ln -sf "$NGINX_SITE_AVAIL" "$NGINX_SITE_ENABLED"
  fi

  if [[ -e "/etc/nginx/sites-enabled/default" ]]; then
    $SUDO rm -f /etc/nginx/sites-enabled/default
  fi

  if is_local_domain "$QLTB_DOMAIN"; then
    LOCAL_CERT_DIR="/etc/ssl/qltb"
    LOCAL_CERT_FILE="${LOCAL_CERT_DIR}/${QLTB_DOMAIN}.crt"
    LOCAL_KEY_FILE="${LOCAL_CERT_DIR}/${QLTB_DOMAIN}.key"

    log_warn "Domain '${QLTB_DOMAIN}' là local/private, không thể dùng Let's Encrypt."
    log_info "Cài nginx + openssl để tạo self-signed certificate"
    $SUDO apt-get update -y
    $SUDO apt-get install -y nginx openssl
    $SUDO mkdir -p "$LOCAL_CERT_DIR"

    if [[ ! -f "$LOCAL_CERT_FILE" || ! -f "$LOCAL_KEY_FILE" ]]; then
      log_info "Tạo self-signed certificate cho local SSL"
      $SUDO openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 825 \
        -keyout "$LOCAL_KEY_FILE" \
        -out "$LOCAL_CERT_FILE" \
        -subj "/CN=${QLTB_DOMAIN}" \
        -addext "subjectAltName=DNS:${QLTB_DOMAIN},DNS:localhost,IP:127.0.0.1"
      $SUDO chmod 600 "$LOCAL_KEY_FILE"
      $SUDO chmod 644 "$LOCAL_CERT_FILE"
    else
      log_info "Self-signed certificate đã tồn tại, giữ nguyên"
    fi

    log_info "Tạo/cập nhật nginx server block local SSL: ${NGINX_SITE_AVAIL}"
    cat <<EOF | $SUDO tee "$NGINX_SITE_AVAIL" >/dev/null
server {
    listen 80;
    listen [::]:80;
    server_name ${QLTB_DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${QLTB_DOMAIN};

    ssl_certificate ${LOCAL_CERT_FILE};
    ssl_certificate_key ${LOCAL_KEY_FILE};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /docs {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    log_info "Kiểm tra cấu hình nginx"
    $SUDO nginx -t
    $SUDO systemctl enable --now nginx
    $SUDO systemctl reload nginx
    log_ok "Local SSL đã sẵn sàng tại https://${QLTB_DOMAIN} (self-signed)"
  else
    log_info "Cài nginx + certbot + plugin nginx"
    $SUDO apt-get update -y
    $SUDO apt-get install -y nginx certbot python3-certbot-nginx

    log_info "Tạo/cập nhật nginx server block: ${NGINX_SITE_AVAIL}"
    cat <<EOF | $SUDO tee "$NGINX_SITE_AVAIL" >/dev/null
server {
    listen 80;
    listen [::]:80;
    server_name ${QLTB_DOMAIN};

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /docs {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    log_info "Kiểm tra cấu hình nginx"
    $SUDO nginx -t
    $SUDO systemctl enable --now nginx
    $SUDO systemctl reload nginx

    CERTBOT_ARGS=(
      --nginx
      -d "$QLTB_DOMAIN"
      --agree-tos
      --redirect
      --non-interactive
      -m "$LETSENCRYPT_EMAIL"
      --keep-until-expiring
    )

    if [[ "$OPT_HTTPS_STAGING" == "true" ]]; then
      CERTBOT_ARGS+=(--staging)
      log_warn "Đang dùng Let's Encrypt staging"
    fi

    log_info "Chạy certbot --nginx"
    $SUDO certbot "${CERTBOT_ARGS[@]}"

    log_info "Bật auto renew qua systemd timer"
    $SUDO systemctl enable --now certbot.timer
    $SUDO systemctl reload nginx
    log_ok "HTTPS đã được cấu hình cho ${QLTB_DOMAIN}"
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

if [[ "$OPT_SETUP_HTTPS" == "true" ]]; then
  echo -e ""
  echo -e "  ${BOLD}HTTPS:${RESET}"
  echo -e "    Domain: ${CYAN}${QLTB_DOMAIN}${RESET}"
  echo -e "    Renew timer: ${CYAN}systemctl status certbot.timer${RESET}"
fi

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
