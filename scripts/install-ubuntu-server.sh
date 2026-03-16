#!/usr/bin/env bash
set -Eeuo pipefail

IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${APP_ROOT}/.env"
OVERRIDE_FILE="${APP_ROOT}/docker-compose.server.override.yml"
UPLOAD_DIR="${APP_ROOT}/uploads"

TARGET_USER="${SUDO_USER:-${USER}}"
PUBLIC_HOST="${1:-${PUBLIC_HOST:-}}"

NODE_MAJOR="${NODE_MAJOR:-20}"
WEB_PORT="${WEB_PORT:-80}"
PORT="${PORT:-3000}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"
PGADMIN_PORT="${PGADMIN_PORT:-8080}"
REDIS_INSIGHT_PORT="${REDIS_INSIGHT_PORT:-8001}"

POSTGRES_DB="${POSTGRES_DB:-qltb}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
PGADMIN_EMAIL="${PGADMIN_EMAIL:-admin@example.com}"
PGADMIN_PASSWORD="${PGADMIN_PASSWORD:-}"
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
LOG_LEVEL="${LOG_LEVEL:-warn}"
ENABLE_RATE_LIMIT="${ENABLE_RATE_LIMIT:-true}"
ENABLE_UFW="${ENABLE_UFW:-true}"
ENABLE_PGADMIN="${ENABLE_PGADMIN:-false}"
ENABLE_REDIS_INSIGHT="${ENABLE_REDIS_INSIGHT:-false}"
FORCE_OVERWRITE_ENV="${FORCE_OVERWRITE_ENV:-false}"

log() {
    printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

warn() {
    printf '\n[WARN] %s\n' "$*" >&2
}

fail() {
    printf '\n[ERROR] %s\n' "$*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

run_sudo() {
    if [ "${EUID}" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

require_repo_root() {
    [ -f "${APP_ROOT}/docker-compose.yml" ] || fail "Khong tim thay docker-compose.yml. Hay chay script nay tu repo QuanLyThietBi."
    [ -f "${APP_ROOT}/package.json" ] || fail "Khong tim thay package.json o root repo."
}

ensure_ubuntu() {
    [ -f /etc/os-release ] || fail "Khong tim thay /etc/os-release."
    if ! grep -qi '^ID=ubuntu' /etc/os-release && ! grep -qi '^ID_LIKE=.*ubuntu' /etc/os-release; then
        fail "Script nay chi ho tro Ubuntu server."
    fi
}

generate_secret() {
    local bytes="$1"
    openssl rand -hex "${bytes}"
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

    [ -n "${PUBLIC_HOST}" ] || fail "Khong tu dong detect duoc PUBLIC_HOST. Hay truyen domain/IP lam tham so thu nhat."
}

install_base_packages() {
    log "Cap nhat apt va cai cac goi he thong co ban"
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

install_docker() {
    if command_exists docker && docker compose version >/dev/null 2>&1; then
        log "Docker va Docker Compose da co san"
        return
    fi

    log "Cai Docker Engine va Docker Compose plugin"
    run_sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | run_sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    run_sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | run_sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    run_sudo apt-get update -y
    run_sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    run_sudo systemctl enable --now docker

    if id -nG "${TARGET_USER}" | grep -qw docker; then
        :
    else
        run_sudo usermod -aG docker "${TARGET_USER}"
        warn "Da them user ${TARGET_USER} vao group docker. Login lai shell sau khi script chay xong de dung docker khong can sudo."
    fi
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

prepare_runtime_dirs() {
    log "Tao thu muc runtime can thiet"
    mkdir -p "${UPLOAD_DIR}"
}

write_env_file() {
    if [ -f "${ENV_FILE}" ] && [ "${FORCE_OVERWRITE_ENV}" != "true" ]; then
        log "Giu nguyen ${ENV_FILE} hien tai (dat FORCE_OVERWRITE_ENV=true neu muon ghi de)"
        return
    fi

    [ -n "${POSTGRES_PASSWORD}" ] || POSTGRES_PASSWORD="$(generate_secret 24)"
    [ -n "${REDIS_PASSWORD}" ] || REDIS_PASSWORD="$(generate_secret 24)"
    [ -n "${PGADMIN_PASSWORD}" ] || PGADMIN_PASSWORD="$(generate_secret 18)"
    [ -n "${JWT_ACCESS_SECRET}" ] || JWT_ACCESS_SECRET="$(generate_secret 64)"
    [ -n "${JWT_REFRESH_SECRET}" ] || JWT_REFRESH_SECRET="$(generate_secret 64)"

    log "Sinh file ${ENV_FILE} cho production tren server"
    cat >"${ENV_FILE}" <<EOF
NODE_ENV=production
HOST=0.0.0.0
PORT=${PORT}
WEB_PORT=${WEB_PORT}

DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}
DATABASE_POOL_MAX=20

POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_PORT=${POSTGRES_PORT}

REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:${REDIS_PORT}
REDIS_CACHE_ENABLED=true
REDIS_CACHE_TTL=900
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_PORT=${REDIS_PORT}

RUN_MIGRATIONS=${RUN_MIGRATIONS}

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
BACKEND_BASE_URL=http://api:3000/api

LOG_LEVEL=${LOG_LEVEL}

ENABLE_RATE_LIMIT=${ENABLE_RATE_LIMIT}
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000

PGADMIN_EMAIL=${PGADMIN_EMAIL}
PGADMIN_PASSWORD=${PGADMIN_PASSWORD}
PGADMIN_PORT=${PGADMIN_PORT}
REDIS_INSIGHT_PORT=${REDIS_INSIGHT_PORT}
EOF
}

write_compose_override() {
    log "Tao compose override cho Ubuntu server"
    cat >"${OVERRIDE_FILE}" <<'EOF'
services:
  postgres:
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"

  redis:
    ports:
      - "127.0.0.1:${REDIS_PORT:-6379}:6379"

  api:
    ports:
      - "${PORT:-3000}:3000"

  web-ui:
    ports:
      - "${WEB_PORT:-80}:3001"
EOF
}

configure_firewall() {
    if [ "${ENABLE_UFW}" != "true" ]; then
        log "Bo qua cau hinh UFW (ENABLE_UFW=false)"
        return
    fi

    log "Cau hinh UFW chi mo SSH, web va API"
    run_sudo ufw allow OpenSSH
    run_sudo ufw allow "${WEB_PORT}/tcp"
    run_sudo ufw allow "${PORT}/tcp"

    if [ "${ENABLE_PGADMIN}" = "true" ]; then
        run_sudo ufw allow "${PGADMIN_PORT}/tcp"
    fi

    if [ "${ENABLE_REDIS_INSIGHT}" = "true" ]; then
        run_sudo ufw allow "${REDIS_INSIGHT_PORT}/tcp"
    fi

    run_sudo ufw --force enable
}

compose_up() {
    local services=(postgres redis api web-ui)

    if [ "${ENABLE_PGADMIN}" = "true" ]; then
        services+=(pgadmin)
    fi

    if [ "${ENABLE_REDIS_INSIGHT}" = "true" ]; then
        services+=(redis-insight)
    fi

    log "Build va khoi dong stack Docker: ${services[*]}"
    run_sudo docker compose \
        -f "${APP_ROOT}/docker-compose.yml" \
        -f "${OVERRIDE_FILE}" \
        up -d --build "${services[@]}"
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
    log "Hoan tat cai dat server"
    cat <<EOF

QLTB da duoc trien khai tren Ubuntu server.

Repo root: ${APP_ROOT}
Env file : ${ENV_FILE}

Web UI   : http://${PUBLIC_HOST}:${WEB_PORT}
API      : http://${PUBLIC_HOST}:${PORT}
Swagger  : http://${PUBLIC_HOST}:${PORT}/docs

PostgreSQL host port: 127.0.0.1:${POSTGRES_PORT}
Redis host port     : 127.0.0.1:${REDIS_PORT}

Neu bat admin tools:
  pgAdmin       : http://${PUBLIC_HOST}:${PGADMIN_PORT}
  Redis Insight : http://${PUBLIC_HOST}:${REDIS_INSIGHT_PORT}

Lenh quan ly:
  sudo docker compose -f docker-compose.yml -f docker-compose.server.override.yml ps
  sudo docker compose -f docker-compose.yml -f docker-compose.server.override.yml logs -f api
  sudo docker compose -f docker-compose.yml -f docker-compose.server.override.yml pull
  sudo docker compose -f docker-compose.yml -f docker-compose.server.override.yml up -d --build

EOF
}

main() {
    ensure_ubuntu
    require_repo_root
    detect_public_host

    install_base_packages
    install_docker
    install_node_toolchain
    prepare_runtime_dirs
    write_env_file
    write_compose_override
    configure_firewall
    compose_up
    wait_for_http "API" "http://127.0.0.1:${PORT}/health/ready" 90 5
    wait_for_http "Web UI" "http://127.0.0.1:${WEB_PORT}" 90 5
    print_summary
}

main "$@"