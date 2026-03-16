#!/usr/bin/env bash
# =============================================================================
# QLTB — Standalone Ubuntu Deployment Script (no Docker)
# =============================================================================
# Sử dụng:
#   bash scripts/install-ubuntu-standalone.sh [PUBLIC_HOST]
#
# Biến môi trường có thể override trước khi chạy:
#   PUBLIC_HOST            IP hoặc domain (tự detect nếu bỏ trống)
#   NODE_MAJOR             Phiên bản Node.js major (mặc định: 20)
#   PORT                   Port API              (mặc định: 3000)
#   WEB_PORT               Port Web UI           (mặc định: 3001)
#   POSTGRES_PORT          Port PostgreSQL        (mặc định: 5432)
#   REDIS_PORT             Port Redis             (mặc định: 6379)
#   POSTGRES_DB            Tên database           (mặc định: qltb)
#   POSTGRES_USER          User PostgreSQL        (mặc định: qltb_user)
#   POSTGRES_PASSWORD      Tự sinh nếu bỏ trống
#   REDIS_PASSWORD         Tự sinh nếu bỏ trống
#   JWT_ACCESS_SECRET      Tự sinh nếu bỏ trống
#   JWT_REFRESH_SECRET     Tự sinh nếu bỏ trống
#   RUN_DB_SEED            Chạy seed data (mặc định: true)
#   INSTALL_NGINX          Cài Nginx reverse proxy (mặc định: false)
#   ENABLE_UFW             Cấu hình firewall UFW  (mặc định: true)
#   FORCE_OVERWRITE_ENV    Ghi đè .env nếu đã tồn tại (mặc định: false)
#   LOG_LEVEL              Pino log level          (mặc định: warn)
# =============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
trap 'fail "Script thất bại tại dòng ${LINENO} — lệnh: ${BASH_COMMAND}"' ERR

# -----------------------------------------------------------------------------
# 0. Hằng số và biến cấu hình
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_ROOT}/.env"
UPLOAD_DIR="${APP_ROOT}/uploads"
TARGET_USER="${SUDO_USER:-${USER}}"

PUBLIC_HOST="${1:-${PUBLIC_HOST:-}}"

NODE_MAJOR="${NODE_MAJOR:-20}"
PORT="${PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"

POSTGRES_DB="${POSTGRES_DB:-qltb}"
POSTGRES_USER="${POSTGRES_USER:-qltb_user}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}"

RUN_DB_SEED="${RUN_DB_SEED:-true}"
INSTALL_NGINX="${INSTALL_NGINX:-false}"
ENABLE_UFW="${ENABLE_UFW:-true}"
FORCE_OVERWRITE_ENV="${FORCE_OVERWRITE_ENV:-false}"
LOG_LEVEL="${LOG_LEVEL:-warn}"

API_SERVICE="qltb-api"
WEB_SERVICE="qltb-web"

# -----------------------------------------------------------------------------
# 1. Hàm tiện ích
# -----------------------------------------------------------------------------
log()  { printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
warn() { printf '\n[WARN]  %s\n' "$*" >&2; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

has_cmd() { command -v "$1" >/dev/null 2>&1; }

run_sudo() {
    # Nếu có -u flag (chuyển user), luôn dùng sudo dù là root
    if [ "${EUID:-0}" -eq 0 ] && [ "${1:-}" != "-u" ]; then
        "$@"
    else
        sudo "$@"
    fi
}

generate_secret() {
    openssl rand -hex "${1:?generate_secret requires byte count}"
}

# -----------------------------------------------------------------------------
# 2. Kiểm tra môi trường
# -----------------------------------------------------------------------------
ensure_ubuntu() {
    [ -f /etc/os-release ] || fail "Không tìm thấy /etc/os-release."
    # shellcheck source=/dev/null
    source /etc/os-release
    if [[ "${ID:-}" != "ubuntu" && "${ID_LIKE:-}" != *ubuntu* ]]; then
        fail "Script này chỉ hỗ trợ Ubuntu."
    fi
    log "Ubuntu phiên bản: ${PRETTY_NAME:-unknown}"
}

require_repo_root() {
    [ -f "${APP_ROOT}/package.json" ]              || fail "Không tìm thấy package.json tại ${APP_ROOT}."
    [ -f "${APP_ROOT}/apps/api/package.json" ]     || fail "Không tìm thấy apps/api."
    [ -f "${APP_ROOT}/apps/web-ui/package.json" ]  || fail "Không tìm thấy apps/web-ui."
    log "Repo root: ${APP_ROOT}"
}

detect_public_host() {
    [ -n "${PUBLIC_HOST}" ] && return

    if has_cmd curl; then
        PUBLIC_HOST="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
    fi

    if [ -z "${PUBLIC_HOST}" ]; then
        PUBLIC_HOST="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    fi

    [ -n "${PUBLIC_HOST}" ] || fail "Không detect được PUBLIC_HOST. Truyền IP/domain làm tham số đầu tiên."
    log "PUBLIC_HOST: ${PUBLIC_HOST}"
}

# -----------------------------------------------------------------------------
# 3. Cài đặt packages
# -----------------------------------------------------------------------------
wait_for_apt_lock() {
    # Dừng unattended-upgrades để tránh lock conflict
    run_sudo systemctl stop unattended-upgrades 2>/dev/null || true
    run_sudo systemctl stop apt-daily.service apt-daily-upgrade.service 2>/dev/null || true

    local waited=0
    while run_sudo fuser \
            /var/lib/dpkg/lock-frontend \
            /var/lib/dpkg/lock \
            /var/lib/apt/lists/lock \
            >/dev/null 2>&1; do
        [ $((waited % 30)) -eq 0 ] && log "Chờ apt/dpkg lock được giải phóng... (${waited}s)"
        sleep 5
        waited=$((waited + 5))
        [ "${waited}" -lt 300 ] || fail "Chờ apt lock quá 5 phút. Chạy: sudo fuser /var/lib/dpkg/lock-frontend"
    done
    export DEBIAN_FRONTEND=noninteractive
}

install_base_packages() {
    log "Cập nhật apt và cài packages hệ thống cơ bản"
    wait_for_apt_lock
    run_sudo apt-get update -y
    run_sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        git \
        gnupg \
        lsb-release \
        openssl \
        software-properties-common \
        ufw \
        wget
}

install_node_toolchain() {
    if has_cmd node && node --version 2>/dev/null | grep -q "^v${NODE_MAJOR}"; then
        log "Node.js $(node --version) đã tồn tại"
    else
        log "Cài Node.js ${NODE_MAJOR}.x từ nodesource"
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | run_sudo bash -
        run_sudo apt-get install -y nodejs
    fi
    log "Node.js: $(node --version) | npm: $(npm --version)"

    log "Bật corepack và kích hoạt pnpm"
    run_sudo corepack enable
    run_sudo corepack prepare pnpm@latest --activate
    log "pnpm: $(pnpm --version)"
}

install_postgres() {
    if has_cmd psql && has_cmd pg_isready; then
        log "PostgreSQL đã tồn tại: $(psql --version)"
        run_sudo systemctl enable --now postgresql
        return
    fi

    log "Cài PostgreSQL từ apt"
    run_sudo apt-get install -y postgresql postgresql-contrib
    run_sudo systemctl enable --now postgresql
    log "PostgreSQL: $(psql --version)"
}

install_redis() {
    if has_cmd redis-server; then
        log "Redis đã tồn tại: $(redis-server --version)"
        run_sudo systemctl enable --now redis-server
        return
    fi

    log "Cài Redis từ apt"
    run_sudo apt-get install -y redis-server
    run_sudo systemctl enable --now redis-server
    log "Redis: $(redis-server --version)"
}

install_nginx() {
    [ "${INSTALL_NGINX}" = "true" ] || return 0

    if has_cmd nginx; then
        log "Nginx đã tồn tại: $(nginx -v 2>&1)"
        run_sudo systemctl enable --now nginx
        return
    fi

    log "Cài Nginx"
    run_sudo apt-get install -y nginx
    run_sudo systemctl enable --now nginx
}

# -----------------------------------------------------------------------------
# 4. Cấu hình PostgreSQL
# -----------------------------------------------------------------------------
find_postgres_config_dir() {
    # Ưu tiên detect phiên bản từ psql --version, fallback dùng find
    local pg_major conf_dir
    pg_major="$(psql --version 2>/dev/null | grep -oP '\d+' | head -1 || true)"

    if [ -n "${pg_major}" ] && [ -d "/etc/postgresql/${pg_major}/main" ]; then
        conf_dir="/etc/postgresql/${pg_major}/main"
    else
        conf_dir="$(find /etc/postgresql -maxdepth 2 -name "postgresql.conf" 2>/dev/null \
                    | head -1 | xargs dirname 2>/dev/null || true)"
    fi

    [ -n "${conf_dir}" ] || fail "Không tìm thấy thư mục cấu hình PostgreSQL tại /etc/postgresql/."
    echo "${conf_dir}"
}

configure_postgres_config() {
    log "Cấu hình PostgreSQL: bind localhost, auth, port"

    local conf_dir conf_file hba_file
    conf_dir="$(find_postgres_config_dir)"
    conf_file="${conf_dir}/postgresql.conf"
    hba_file="${conf_dir}/pg_hba.conf"

    [ -f "${conf_file}" ] || fail "Không tìm thấy ${conf_file}"
    [ -f "${hba_file}" ]  || fail "Không tìm thấy ${hba_file}"
    log "Config dir: ${conf_dir}"

    # bind chỉ localhost
    run_sudo sed -i "s/^#*listen_addresses\s*=.*/listen_addresses = 'localhost'/" "${conf_file}"

    # Đổi host auth (IPv4) sang scram-sha-256 (Ubuntu 22+/24+)
    # Xử lý cả md5, trust, peer, ident, scram-sha-256
    run_sudo sed -i -E \
        "s|^(host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1/32)[[:space:]]+.*|\1 scram-sha-256|" \
        "${hba_file}"

    # Nếu dòng host IPv4 không có, thêm vào
    run_sudo grep -qP "^host\s+all\s+all\s+127\.0\.0\.1/32" "${hba_file}" \
        || printf '\nhost all all 127.0.0.1/32 scram-sha-256\n' | run_sudo tee -a "${hba_file}" >/dev/null

    # Đảm bảo port đúng
    if run_sudo grep -q '^port\s*=' "${conf_file}"; then
        run_sudo sed -i "s/^port\s*=.*/port = ${POSTGRES_PORT}/" "${conf_file}"
    elif run_sudo grep -q '^#port\s*=' "${conf_file}"; then
        run_sudo sed -i "s/^#port\s*=.*/port = ${POSTGRES_PORT}/" "${conf_file}"
    else
        printf '\nport = %s\n' "${POSTGRES_PORT}" | run_sudo tee -a "${conf_file}" >/dev/null
    fi

    run_sudo systemctl restart postgresql
    log "PostgreSQL đã restart"
}

configure_postgres_db() {
    log "Tạo user và database PostgreSQL"

    run_sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
    END IF;
END
\$\$;
SQL

    local db_exists
    db_exists="$(run_sudo -u postgres psql -tAc \
        "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}';" 2>/dev/null || true)"
    if [ "${db_exists}" != "1" ]; then
        run_sudo -u postgres createdb -O "${POSTGRES_USER}" "${POSTGRES_DB}"
    fi

    run_sudo -u postgres psql -v ON_ERROR_STOP=1 \
        -c "GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};"

    log "Database '${POSTGRES_DB}' và user '${POSTGRES_USER}' sẵn sàng"
}

# -----------------------------------------------------------------------------
# 5. Cấu hình Redis
# -----------------------------------------------------------------------------
configure_redis() {
    log "Cấu hình Redis: bind localhost, password, port"

    local redis_conf="/etc/redis/redis.conf"
    [ -f "${redis_conf}" ] || fail "Không tìm thấy ${redis_conf}."

    # Bind IPv4 only — tránh lỗi nếu server không có IPv6
    run_sudo sed -i -E "s|^#?bind .*|bind 127.0.0.1|"           "${redis_conf}"
    run_sudo sed -i -E "s|^#?protected-mode .*|protected-mode yes|" "${redis_conf}"

    if run_sudo grep -q '^requirepass ' "${redis_conf}" 2>/dev/null; then
        run_sudo sed -i "s|^requirepass .*|requirepass ${REDIS_PASSWORD}|" "${redis_conf}"
    else
        printf '\nrequirepass %s\n' "${REDIS_PASSWORD}" | run_sudo tee -a "${redis_conf}" >/dev/null
    fi

    if run_sudo grep -q '^port ' "${redis_conf}" 2>/dev/null; then
        run_sudo sed -i "s|^port .*|port ${REDIS_PORT}|" "${redis_conf}"
    fi

    run_sudo systemctl restart redis-server
    log "Redis đã restart"
}

# -----------------------------------------------------------------------------
# 6. Tạo .env và load credentials
# -----------------------------------------------------------------------------

# Parse POSTGRES_PASSWORD và REDIS_PASSWORD từ .env đã có (khi skip write)
load_credentials_from_env() {
    [ -n "${POSTGRES_PASSWORD}" ] && [ -n "${REDIS_PASSWORD}" ] && return

    local db_url redis_url
    db_url="$(grep '^DATABASE_URL=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
    redis_url="$(grep '^REDIS_URL=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"

    # DATABASE_URL format: postgresql://user:PASSWORD@host:port/db
    [ -z "${POSTGRES_PASSWORD}" ] && [ -n "${db_url}" ] && \
        POSTGRES_PASSWORD="$(printf '%s' "${db_url}" | sed 's|^[^:]*://[^:]*:\([^@]*\)@.*|\1|')"

    # REDIS_URL format: redis://:PASSWORD@host:port
    [ -z "${REDIS_PASSWORD}" ] && [ -n "${redis_url}" ] && \
        REDIS_PASSWORD="$(printf '%s' "${redis_url}" | sed 's|^redis://:\([^@]*\)@.*|\1|')"

    [ -n "${POSTGRES_PASSWORD}" ] || fail "Không đọc được POSTGRES_PASSWORD từ ${ENV_FILE}. Kiểm tra DATABASE_URL."
    [ -n "${REDIS_PASSWORD}" ]    || fail "Không đọc được REDIS_PASSWORD từ ${ENV_FILE}. Kiểm tra REDIS_URL."
    log "Credentials đã load từ ${ENV_FILE}"
}

write_env_file() {
    if [ -f "${ENV_FILE}" ] && [ "${FORCE_OVERWRITE_ENV}" != "true" ]; then
        log "Giữ nguyên ${ENV_FILE} (đặt FORCE_OVERWRITE_ENV=true để ghi đè)"
        return
    fi

    [ -n "${POSTGRES_PASSWORD}" ] || POSTGRES_PASSWORD="$(generate_secret 24)"
    [ -n "${REDIS_PASSWORD}" ]    || REDIS_PASSWORD="$(generate_secret 24)"
    [ -n "${JWT_ACCESS_SECRET}" ] || JWT_ACCESS_SECRET="$(generate_secret 64)"
    [ -n "${JWT_REFRESH_SECRET}" ]|| JWT_REFRESH_SECRET="$(generate_secret 64)"

    log "Sinh file ${ENV_FILE} cho production standalone"
    cat >"${ENV_FILE}" <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=${PORT}
WEB_PORT=${WEB_PORT}

DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}
DATABASE_POOL_MAX=20

REDIS_URL=redis://:${REDIS_PASSWORD}@127.0.0.1:${REDIS_PORT}
REDIS_CACHE_ENABLED=true
REDIS_CACHE_TTL=900

RUN_MIGRATIONS=false

JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
DISABLE_AUTH=false

ASSET_UPLOAD_DIR=${UPLOAD_DIR}

SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@${PUBLIC_HOST}

VITE_API_BASE=http://${PUBLIC_HOST}:${PORT}/api
VITE_API_URL=http://${PUBLIC_HOST}:${PORT}/api
BACKEND_BASE_URL=http://127.0.0.1:${PORT}/api
VITE_DEPLOYMENT_MODE=standalone

LOG_LEVEL=${LOG_LEVEL}

ENABLE_RATE_LIMIT=true
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
EOF
    log "Đã ghi ${ENV_FILE}"
}

# -----------------------------------------------------------------------------
# 7. Build ứng dụng
# -----------------------------------------------------------------------------
prepare_runtime_dirs() {
    log "Tạo thư mục runtime"
    mkdir -p "${UPLOAD_DIR}"
}

install_and_build() {
    log "Cài pnpm dependencies (frozen-lockfile)"
    cd "${APP_ROOT}"
    # Nạp .env để VITE_API_BASE được dùng khi build web
    # shellcheck source=/dev/null
    set -o allexport; source "${ENV_FILE}"; set +o allexport
    pnpm install --frozen-lockfile

    # Xóa dist cũ để tránh stale .tsbuildinfo làm miss .d.ts
    log "Dọn dẹp build artifacts cũ của packages"
    for pkg in domain contracts application infra-postgres; do
        rm -rf "${APP_ROOT}/packages/${pkg}/dist"
        find "${APP_ROOT}/packages/${pkg}" -maxdepth 1 -name "*.tsbuildinfo" -delete 2>/dev/null || true
    done

    # Build packages với tsc --build --force (composite projects cần --build, không phải --project)
    for pkg in domain contracts application infra-postgres; do
        log "Build package: @qltb/${pkg}"
        cd "${APP_ROOT}/packages/${pkg}"
        pnpm exec tsc --build --force tsconfig.json
    done
    cd "${APP_ROOT}"

    log "Build app: @qltb/api (tsup)"
    pnpm --filter @qltb/api build

    log "Build app: @qltb/web-ui (Vite)"
    pnpm --filter @qltb/web-ui build
}

run_database_setup() {
    log "Chạy migrations"
    cd "${APP_ROOT}"
    pnpm db:migrate

    if [ "${RUN_DB_SEED}" = "true" ]; then
        log "Chạy seed data"
        pnpm db:seed
    else
        log "Bỏ qua seed data (RUN_DB_SEED=false)"
    fi
}

# -----------------------------------------------------------------------------
# 8. Systemd services
# -----------------------------------------------------------------------------
write_api_service() {
    log "Tạo systemd service: ${API_SERVICE}"
    run_sudo tee "/etc/systemd/system/${API_SERVICE}.service" >/dev/null <<EOF
[Unit]
Description=QLTB API Server (Fastify)
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${APP_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${APP_ROOT}/apps/api/dist/main.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${API_SERVICE}

[Install]
WantedBy=multi-user.target
EOF
}

write_web_service() {
    log "Tạo systemd service: ${WEB_SERVICE}"
    # adapter-node build entry point là build/index.js
    run_sudo tee "/etc/systemd/system/${WEB_SERVICE}.service" >/dev/null <<EOF
[Unit]
Description=QLTB Web UI Server (SvelteKit adapter-node)
After=network.target ${API_SERVICE}.service
Wants=${API_SERVICE}.service

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${APP_ROOT}/apps/web-ui
EnvironmentFile=${ENV_FILE}
Environment=HOST=0.0.0.0
Environment=PORT=${WEB_PORT}
Environment=ORIGIN=http://${PUBLIC_HOST}:${WEB_PORT}
ExecStart=/usr/bin/node ${APP_ROOT}/apps/web-ui/build/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${WEB_SERVICE}

[Install]
WantedBy=multi-user.target
EOF
}

enable_services() {
    log "Reload systemd và khởi động services"
    run_sudo systemctl daemon-reload
    run_sudo systemctl enable --now "${API_SERVICE}.service"
    run_sudo systemctl enable --now "${WEB_SERVICE}.service"
}

# -----------------------------------------------------------------------------
# 9. Nginx (tuỳ chọn)
# -----------------------------------------------------------------------------
configure_nginx() {
    [ "${INSTALL_NGINX}" = "true" ] || return 0

    log "Cấu hình Nginx reverse proxy"
    run_sudo tee /etc/nginx/sites-available/qltb >/dev/null <<EOF
server {
    listen 80;
    server_name ${PUBLIC_HOST};

    # API
    location /api/ {
        proxy_pass         http://127.0.0.1:${PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # Swagger docs
    location /docs {
        proxy_pass         http://127.0.0.1:${PORT}/docs;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
    }

    # Web UI (tất cả còn lại)
    location / {
        proxy_pass         http://127.0.0.1:${WEB_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF

    run_sudo ln -sf /etc/nginx/sites-available/qltb /etc/nginx/sites-enabled/qltb
    run_sudo rm -f /etc/nginx/sites-enabled/default
    run_sudo nginx -t
    run_sudo systemctl restart nginx
    log "Nginx đã được cấu hình"
}

# -----------------------------------------------------------------------------
# 10. Firewall
# -----------------------------------------------------------------------------
configure_firewall() {
    [ "${ENABLE_UFW}" = "true" ] || { log "Bỏ qua UFW (ENABLE_UFW=false)"; return 0; }

    log "Cấu hình UFW"
    run_sudo ufw allow OpenSSH

    if [ "${INSTALL_NGINX}" = "true" ]; then
        run_sudo ufw allow 80/tcp
        run_sudo ufw allow 443/tcp
    else
        run_sudo ufw allow "${PORT}/tcp"
        run_sudo ufw allow "${WEB_PORT}/tcp"
    fi

    run_sudo ufw --force enable
    log "UFW đã bật"
}

# -----------------------------------------------------------------------------
# 11. Health check
# -----------------------------------------------------------------------------
wait_for_http() {
    local name="$1" url="$2"
    local attempts="${3:-72}" delay="${4:-5}"

    log "Chờ ${name} sẵn sàng: ${url}"
    for _ in $(seq 1 "${attempts}"); do
        if curl -fsS --max-time 3 "${url}" >/dev/null 2>&1; then
            log "${name} sẵn sàng"
            return 0
        fi
        sleep "${delay}"
    done

    fail "${name} không phản hồi sau $((attempts * delay))s. Kiểm tra log: sudo journalctl -u ${name,,} -n 50"
}

# -----------------------------------------------------------------------------
# 12. In tổng kết
# -----------------------------------------------------------------------------
print_summary() {
    local web_url api_url swagger_url
    if [ "${INSTALL_NGINX}" = "true" ]; then
        web_url="http://${PUBLIC_HOST}"
        api_url="http://${PUBLIC_HOST}/api"
        swagger_url="http://${PUBLIC_HOST}/docs"
    else
        web_url="http://${PUBLIC_HOST}:${WEB_PORT}"
        api_url="http://${PUBLIC_HOST}:${PORT}/api"
        swagger_url="http://${PUBLIC_HOST}:${PORT}/docs"
    fi

    cat <<EOF

================================================================================
  QLTB đã deploy thành công (standalone — không Docker)
================================================================================

  Repo root : ${APP_ROOT}
  Env file  : ${ENV_FILE}

  Web UI    : ${web_url}
  API       : ${api_url}
  Swagger   : ${swagger_url}

  PostgreSQL: 127.0.0.1:${POSTGRES_PORT}  DB=${POSTGRES_DB}  User=${POSTGRES_USER}
  Redis     : 127.0.0.1:${REDIS_PORT}

  Systemd services:
    sudo systemctl status  ${API_SERVICE}
    sudo systemctl status  ${WEB_SERVICE}
    sudo journalctl -u ${API_SERVICE} -f
    sudo journalctl -u ${WEB_SERVICE} -f

  Update code (sau khi git pull):
    cd ${APP_ROOT}
    pnpm install --frozen-lockfile
    pnpm build
    pnpm db:migrate
    sudo systemctl restart ${API_SERVICE} ${WEB_SERVICE}

================================================================================
EOF
}

# -----------------------------------------------------------------------------
# main
# -----------------------------------------------------------------------------
main() {
    log "=== QLTB Standalone Deployment ==="

    ensure_ubuntu
    require_repo_root
    detect_public_host

    install_base_packages
    install_node_toolchain
    install_postgres
    install_redis
    install_nginx

    prepare_runtime_dirs
    write_env_file
    load_credentials_from_env

    configure_postgres_config
    configure_postgres_db
    configure_redis

    install_and_build
    run_database_setup

    write_api_service
    write_web_service
    enable_services

    configure_nginx
    configure_firewall

    wait_for_http "${API_SERVICE}" "http://127.0.0.1:${PORT}/health/ready"
    wait_for_http "${WEB_SERVICE}" "http://127.0.0.1:${WEB_PORT}"

    print_summary
}

main "$@"
