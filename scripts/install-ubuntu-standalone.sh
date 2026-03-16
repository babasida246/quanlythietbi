#!/usr/bin/env bash
set -Eeuo pipefail

IFS=$'\n\t'

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
LOG_LEVEL="${LOG_LEVEL:-warn}"
ENABLE_RATE_LIMIT="${ENABLE_RATE_LIMIT:-true}"
ENABLE_UFW="${ENABLE_UFW:-true}"
FORCE_OVERWRITE_ENV="${FORCE_OVERWRITE_ENV:-false}"
RUN_DB_SEED="${RUN_DB_SEED:-true}"
INSTALL_NGINX="${INSTALL_NGINX:-false}"

API_SERVICE_NAME="qltb-api"
WEB_SERVICE_NAME="qltb-web"

# Ensure utility functions are defined at the top of the script
fail() {
    printf '\n[ERROR] %s\n' "$*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1 || fail "Command '$1' not found. Please install it."
}

run_sudo() {
    if [ "${EUID}" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

ensure_ubuntu() {
    [ -f /etc/os-release ] || fail "Khong tim thay /etc/os-release."
    if ! grep -qi '^ID=ubuntu' /etc/os-release && ! grep -qi '^ID_LIKE=.*ubuntu' /etc/os-release; then
        fail "Script nay chi ho tro Ubuntu server."
    fi
}

require_repo_root() {
    [ -f "${APP_ROOT}/package.json" ] || fail "Khong tim thay package.json o root repo."
    [ -f "${APP_ROOT}/apps/api/package.json" ] || fail "Khong tim thay app API."
    [ -f "${APP_ROOT}/apps/web-ui/package.json" ] || fail "Khong tim thay app Web UI."
}

generate_secret() {
    local bytes="$1"
    if [[ -z "$bytes" || ! "$bytes" =~ ^[0-9]+$ ]]; then
        fail "Invalid input to generate_secret. Expected a positive integer."
    fi
    openssl rand -hex "$bytes"
}

detect_public_host() {
    if [ -n "${PUBLIC_HOST}" ]; then
        return
    fi

    if command_exists curl; then
        PUBLIC_HOST="$(curl -fsS --max-time 5 https://api.ipify.org || true)"
    fi

    if [ -z "${PUBLIC_HOST}" ]; then
        PUBLIC_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
    fi

    [ -n "${PUBLIC_HOST}" ] || fail "Khong detect duoc PUBLIC_HOST. Hay truyen IP/domain lam tham so dau tien."
}

install_base_packages() {
    log "Cap nhat apt va cai package he thong"
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
    if command_exists node && command_exists corepack; then
        log "Node.js da co san: $(node --version)"
    else
        log "Cai Node.js ${NODE_MAJOR}.x"
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | run_sudo bash
        run_sudo apt-get install -y nodejs
    fi

    log "Bat corepack va kich hoat pnpm"
    run_sudo corepack enable
    run_sudo corepack prepare pnpm@latest --activate
}

install_postgres() {
    if command_exists psql && command_exists pg_isready; then
        log "PostgreSQL da co san"
    else
        log "Cai PostgreSQL"
        run_sudo apt-get install -y postgresql postgresql-contrib
    fi

    run_sudo systemctl enable --now postgresql
}

configure_postgres_service() {
    log "Cau hinh PostgreSQL bind localhost va port runtime"

    local conf_file hba_file
    # Correctly use sudo to switch to the postgres user
    conf_file="$(sudo -u postgres psql -Atqc "SHOW config_file")"
    hba_file="$(sudo -u postgres psql -Atqc "SHOW hba_file")"

    log "Sua config_file: ${conf_file}"
    sudo sed -i "s/^#*listen_addresses = .*/listen_addresses = 'localhost'/" "${conf_file}"

    log "Sua hba_file: ${hba_file}"
    sudo sed -i "s/^host\s\+all\s\+all\s\+127.0.0.1\/32\s\+.*$/host all all 127.0.0.1\/32 md5/" "${hba_file}"

    log "Khoi dong lai PostgreSQL"
    sudo systemctl restart postgresql
}

install_redis() {
    if command_exists redis-server; then
        log "Redis da co san"
    else
        log "Cai Redis"
        run_sudo apt-get install -y redis-server
    fi

    run_sudo systemctl enable --now redis-server
}

install_nginx() {
    if [ "${INSTALL_NGINX}" != "true" ]; then
        return
    fi

    if command_exists nginx; then
        log "Nginx da co san"
    else
        log "Cai Nginx"
        run_sudo apt-get install -y nginx
    fi

    run_sudo systemctl enable --now nginx
}

prepare_runtime_dirs() {
    log "Tao thu muc uploads"
    mkdir -p "${UPLOAD_DIR}"
}

write_env_file() {
    if [ -f "${ENV_FILE}" ] && [ "${FORCE_OVERWRITE_ENV}" != "true" ]; then
        log "Giu nguyen ${ENV_FILE} hien tai (dat FORCE_OVERWRITE_ENV=true neu muon ghi de)"
        return
    fi

    [ -n "${POSTGRES_PASSWORD}" ] || POSTGRES_PASSWORD="$(generate_secret 24)"
    [ -n "${REDIS_PASSWORD}" ] || REDIS_PASSWORD="$(generate_secret 24)"
    [ -n "${JWT_ACCESS_SECRET}" ] || JWT_ACCESS_SECRET="$(generate_secret 64)"
    [ -n "${JWT_REFRESH_SECRET}" ] || JWT_REFRESH_SECRET="$(generate_secret 64)"

    log "Sinh file ${ENV_FILE} cho standalone deployment"
    cat >"${ENV_FILE}" <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=${PORT}
WEB_PORT=${WEB_PORT}

DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
DATABASE_POOL_MAX=20

REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:${REDIS_PORT}
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

LOG_LEVEL=${LOG_LEVEL}

ENABLE_RATE_LIMIT=${ENABLE_RATE_LIMIT}
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
EOF
}

configure_postgres() {
    [ -n "${POSTGRES_PASSWORD}" ] || fail "POSTGRES_PASSWORD chua duoc khoi tao"

    log "Tao database va user PostgreSQL cho he thong"
    run_sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
DO \
\$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
    ELSE
        EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '${POSTGRES_USER}', '${POSTGRES_PASSWORD}');
    END IF;
END
\$\$;
EOF

    run_sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -q 1 || \
        run_sudo -u postgres createdb -O "${POSTGRES_USER}" "${POSTGRES_DB}"

    run_sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOF
GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};
EOF
}

configure_redis() {
    [ -n "${REDIS_PASSWORD}" ] || fail "REDIS_PASSWORD chua duoc khoi tao"

    log "Cau hinh Redis password va bind localhost"
    run_sudo sed -i "s|^#\?bind .*|bind 127.0.0.1 ::1|" /etc/redis/redis.conf
    run_sudo sed -i "s|^#\?protected-mode .*|protected-mode yes|" /etc/redis/redis.conf

    if grep -q '^requirepass ' /etc/redis/redis.conf; then
        run_sudo sed -i "s|^requirepass .*|requirepass ${REDIS_PASSWORD}|" /etc/redis/redis.conf
    else
        printf '\nrequirepass %s\n' "${REDIS_PASSWORD}" | run_sudo tee -a /etc/redis/redis.conf >/dev/null
    fi

    if grep -q '^port ' /etc/redis/redis.conf; then
        run_sudo sed -i "s|^port .*|port ${REDIS_PORT}|" /etc/redis/redis.conf
    fi

    run_sudo systemctl restart redis-server
}

install_dependencies_and_build() {
    log "Cai dependencies va build he thong"
    cd "${APP_ROOT}"
    pnpm install --frozen-lockfile
    pnpm build
}

run_database_setup() {
    log "Chay migrations database"
    cd "${APP_ROOT}"
    pnpm db:migrate

    if [ "${RUN_DB_SEED}" = "true" ]; then
        log "Chay seed data"
        pnpm db:seed
    else
        log "Bo qua seed data (RUN_DB_SEED=false)"
    fi
}

write_api_service() {
    log "Tao systemd service cho API"
    run_sudo tee "/etc/systemd/system/${API_SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=QLTB API Server
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${APP_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${APP_ROOT}/apps/api/dist/main.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
}

write_web_service() {
    log "Tao systemd service cho Web UI"
    run_sudo tee "/etc/systemd/system/${WEB_SERVICE_NAME}.service" >/dev/null <<EOF
[Unit]
Description=QLTB Web UI Server
After=network.target ${API_SERVICE_NAME}.service
Wants=${API_SERVICE_NAME}.service

[Service]
Type=simple
User=${TARGET_USER}
WorkingDirectory=${APP_ROOT}/apps/web-ui
EnvironmentFile=${ENV_FILE}
Environment=HOST=0.0.0.0
Environment=PORT=${WEB_PORT}
Environment=ORIGIN=http://${PUBLIC_HOST}:${WEB_PORT}
ExecStart=/usr/bin/node ${APP_ROOT}/apps/web-ui/build
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
}

configure_nginx_site() {
    if [ "${INSTALL_NGINX}" != "true" ]; then
        return
    fi

    log "Tao Nginx reverse proxy cho Web UI va API"
    run_sudo tee /etc/nginx/sites-available/qltb >/dev/null <<EOF
server {
    listen 80;
    server_name ${PUBLIC_HOST};

    location /api/ {
        proxy_pass http://127.0.0.1:${PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    run_sudo ln -sf /etc/nginx/sites-available/qltb /etc/nginx/sites-enabled/qltb
    run_sudo rm -f /etc/nginx/sites-enabled/default
    run_sudo nginx -t
    run_sudo systemctl restart nginx
}

enable_and_start_services() {
    log "Nap lai systemd va khoi dong services"
    run_sudo systemctl daemon-reload
    run_sudo systemctl enable --now "${API_SERVICE_NAME}.service"
    run_sudo systemctl enable --now "${WEB_SERVICE_NAME}.service"
}

configure_firewall() {
    if [ "${ENABLE_UFW}" != "true" ]; then
        log "Bo qua cau hinh UFW (ENABLE_UFW=false)"
        return
    fi

    log "Cau hinh UFW cho standalone services"
    run_sudo ufw allow OpenSSH
    run_sudo ufw allow "${PORT}/tcp"

    if [ "${INSTALL_NGINX}" = "true" ]; then
        run_sudo ufw allow 80/tcp
        run_sudo ufw allow 443/tcp
    else
        run_sudo ufw allow "${WEB_PORT}/tcp"
    fi

    run_sudo ufw --force enable
}

wait_for_http() {
    local name="$1"
    local url="$2"
    local attempts="${3:-60}"
    local sleep_seconds="${4:-5}"

    log "Cho ${name} san sang: ${url}"
    for _ in $(seq 1 "${attempts}"); do
        if curl -fsS "${url}" >/dev/null 2>&1; then
            log "${name} da san sang"
            return 0
        fi
        sleep "${sleep_seconds}"
    done

    fail "${name} khong san sang sau ${attempts} lan kiem tra"
}

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

    log "Hoan tat deploy standalone"
    cat <<EOF

QLTB da duoc deploy theo che do standalone (khong Docker).

Repo root: ${APP_ROOT}
Env file : ${ENV_FILE}

Web UI  : ${web_url}
API     : ${api_url}
Swagger : ${swagger_url}

Systemd services:
  sudo systemctl status ${API_SERVICE_NAME}
  sudo systemctl status ${WEB_SERVICE_NAME}
  sudo journalctl -u ${API_SERVICE_NAME} -f
  sudo journalctl -u ${WEB_SERVICE_NAME} -f

Database:
  PostgreSQL DB   : ${POSTGRES_DB}
  PostgreSQL User : ${POSTGRES_USER}
  PostgreSQL Port : ${POSTGRES_PORT}
  Redis Port      : ${REDIS_PORT}

EOF
}

main() {
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
    configure_postgres_service
    configure_postgres
    configure_redis
    install_dependencies_and_build
    run_database_setup
    write_api_service
    write_web_service
    enable_and_start_services
    configure_nginx_site
    configure_firewall
    wait_for_http "API" "http://127.0.0.1:${PORT}/health/ready" 90 5
    wait_for_http "Web UI" "http://127.0.0.1:${WEB_PORT}" 90 5
    print_summary
}

main "$@"