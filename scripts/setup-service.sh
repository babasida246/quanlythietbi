#!/usr/bin/env bash
# ==============================================================================
# setup-service.sh — Cài đặt hoàn chỉnh: systemd + nginx + firewall (UFW)
#
# Chạy một lần sau khi deploy lần đầu trên Ubuntu/Debian server.
# Sau đó dùng: bash scripts/deploy.sh --migrate --restart
#
# Usage:
#   sudo bash scripts/setup-service.sh [OPTIONS]
#
# Options:
#   --domain DOMAIN   Domain/IP cho nginx (default: _ = tất cả)
#   --skip-web        Chỉ setup API, bỏ qua web-ui + nginx web block
#   --skip-nginx      Không cài đặt/cấu hình nginx
#   --skip-firewall   Không cấu hình UFW firewall
#   --user USER       Chạy Node services với user này (default: sudo user)
#   --restart         Chỉ restart services đang chạy (không setup lại)
#   --remove          Xóa tất cả: services, nginx site, firewall rules
#   -h, --help        Hiển thị help
#
# Requirements:
#   - Ubuntu 20.04+ / Debian 11+ với systemd
#   - Đã chạy: bash scripts/deploy.sh --migrate (hoặc deploy:fresh)
#   - File .env tại project root
# ==============================================================================
set -euo pipefail

# ── Màu sắc ───────────────────────────────────────────────────────────────────
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';  BOLD='\033[1m'; RESET='\033[0m'

log_step()  { echo -e "\n${BOLD}${BLUE}▶ $*${RESET}"; }
log_ok()    { echo -e "${GREEN}  ✓ $*${RESET}"; }
log_warn()  { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
log_error() { echo -e "${RED}  ✗ $*${RESET}" >&2; }
log_info()  { echo -e "${CYAN}  → $*${RESET}"; }
hr()        { echo -e "${BLUE}══════════════════════════════════════════════════${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Parse arguments ───────────────────────────────────────────────────────────
OPT_DOMAIN="_"
OPT_SKIP_WEB=false
OPT_SKIP_NGINX=false
OPT_SKIP_FIREWALL=false
OPT_RESTART=false
OPT_REMOVE=false
SERVICE_USER="${SUDO_USER:-$(whoami)}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)         OPT_DOMAIN="$2"; shift ;;
    --skip-web)       OPT_SKIP_WEB=true ;;
    --skip-nginx)     OPT_SKIP_NGINX=true ;;
    --skip-firewall)  OPT_SKIP_FIREWALL=true ;;
    --restart)        OPT_RESTART=true ;;
    --remove)         OPT_REMOVE=true ;;
    --user)           SERVICE_USER="$2"; shift ;;
    -h|--help)        sed -n '3,22p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# ── Guard: phải chạy với sudo ─────────────────────────────────────────────────
if [[ "$EUID" -ne 0 ]]; then
  log_error "Cần chạy với sudo: sudo bash scripts/setup-service.sh $*"
  exit 1
fi

if ! command -v systemctl &>/dev/null; then
  log_error "systemd không có sẵn trên hệ thống này."
  exit 1
fi

# ── Tìm node executable của SERVICE_USER ─────────────────────────────────────
_find_node() {
  local bin
  bin="$(su - "$SERVICE_USER" -c 'command -v node 2>/dev/null || true' 2>/dev/null || true)"
  if [[ -z "$bin" ]]; then
    for p in /usr/bin/node /usr/local/bin/node \
              "/home/${SERVICE_USER}/.nvm/versions/node/"*/bin/node \
              "/root/.nvm/versions/node/"*/bin/node; do
      [[ -x "$p" ]] && bin="$p" && break
    done
  fi
  echo "$bin"
}
NODE_BIN="$(_find_node)"
[[ -z "$NODE_BIN" ]] && { log_error "Không tìm thấy node. Cài Node.js >= 20 trước."; exit 1; }

# ── Load ports từ .env ────────────────────────────────────────────────────────
API_PORT=3000; WEB_PORT=3001
if [[ -f "$ROOT/.env" ]]; then
  _p=$(grep -E '^PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
  _w=$(grep -E '^WEB_PORT=' "$ROOT/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
  [[ -n "$_p" ]] && API_PORT="$_p"
  [[ -n "$_w" ]] && WEB_PORT="$_w"
fi

NGINX_SITE="qltb"
NGINX_CONF="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

# ══════════════════════════════════════════════════════════════════════════════
# --remove: gỡ cài đặt hoàn toàn
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_REMOVE" == "true" ]]; then
  log_step "Gỡ cài đặt QLTB"

  for svc in qltb-api qltb-web; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      systemctl stop "$svc" && log_ok "Stopped $svc"
    fi
    if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
      systemctl disable "$svc" && log_ok "Disabled $svc"
    fi
    if [[ -f "/etc/systemd/system/$svc.service" ]]; then
      rm "/etc/systemd/system/$svc.service" && log_ok "Removed $svc.service"
    fi
  done
  systemctl daemon-reload

  [[ -f "/etc/systemd/system/qltb-web.env" ]] && \
    rm "/etc/systemd/system/qltb-web.env" && log_ok "Removed qltb-web.env"

  if [[ -f "$NGINX_CONF" ]]; then
    [[ -L "$NGINX_ENABLED" ]] && rm "$NGINX_ENABLED"
    rm "$NGINX_CONF" && log_ok "Removed nginx site config"
    nginx -t 2>/dev/null && systemctl reload nginx && log_ok "nginx reloaded"
  fi

  if command -v ufw &>/dev/null; then
    ufw delete allow 'Nginx Full' 2>/dev/null || true
    ufw delete allow 80/tcp 2>/dev/null || true
    ufw delete allow 443/tcp 2>/dev/null || true
    log_ok "UFW rules cho HTTP/HTTPS đã xóa (SSH giữ nguyên)"
  fi

  log_ok "Gỡ cài đặt hoàn tất"
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# --restart: chỉ restart, không setup lại
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_RESTART" == "true" ]]; then
  log_step "Restart QLTB services"
  systemctl restart qltb-api  && log_ok "qltb-api restarted"
  [[ "$OPT_SKIP_WEB" == "false" ]] && systemctl restart qltb-web && log_ok "qltb-web restarted"
  if command -v nginx &>/dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl reload nginx && log_ok "nginx reloaded"
  fi
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# Banner
# ══════════════════════════════════════════════════════════════════════════════
hr
echo -e "${BOLD}  QLTB — Server Setup: Systemd + Nginx + Firewall${RESET}"
echo -e "  Root:          ${CYAN}${ROOT}${RESET}"
echo -e "  Service user:  ${CYAN}${SERVICE_USER}${RESET}"
echo -e "  Node:          ${CYAN}${NODE_BIN}${RESET}"
echo -e "  Domain:        ${CYAN}${OPT_DOMAIN}${RESET}"
echo -e "  API port:      ${CYAN}${API_PORT}${RESET} (internal, không expose ra ngoài)"
echo -e "  Web port:      ${CYAN}${WEB_PORT}${RESET} (internal, không expose ra ngoài)"
echo -e "  nginx:         ${CYAN}$([[ "$OPT_SKIP_NGINX" == "true" ]] && echo "skip" || echo "yes")${RESET}"
echo -e "  firewall:      ${CYAN}$([[ "$OPT_SKIP_FIREWALL" == "true" ]] && echo "skip" || echo "yes")${RESET}"
hr

# ── Kiểm tra build artifacts ──────────────────────────────────────────────────
log_step "Kiểm tra build artifacts"

[[ ! -f "$ROOT/apps/api/dist/main.js" ]] && {
  log_error "Không tìm thấy apps/api/dist/main.js"
  log_error "Hãy chạy: bash scripts/deploy.sh --migrate"
  exit 1
}
log_ok "apps/api/dist/main.js"

if [[ "$OPT_SKIP_WEB" == "false" ]]; then
  [[ ! -f "$ROOT/apps/web-ui/build/index.js" ]] && {
    log_error "Không tìm thấy apps/web-ui/build/index.js"
    log_error "Hãy chạy: bash scripts/deploy.sh --migrate"
    exit 1
  }
  log_ok "apps/web-ui/build/index.js"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 1 — Systemd services
# ══════════════════════════════════════════════════════════════════════════════
log_step "BƯỚC 1/3 — Tạo systemd services"

cat > /etc/systemd/system/qltb-api.service <<EOF
[Unit]
Description=QLTB API Server (Fastify)
After=network.target
Wants=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${ROOT}
ExecStart=${NODE_BIN} ${ROOT}/apps/api/dist/main.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=qltb-api
EnvironmentFile=-${ROOT}/.env
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
log_ok "qltb-api.service → port ${API_PORT} (localhost only)"

if [[ "$OPT_SKIP_WEB" == "false" ]]; then
  # Ghi file env riêng cho web service (được load SAU .env, ưu tiên cao hơn)
  # Cần thiết vì .env có PORT=3000 (cho API), service web phải dùng PORT khác
  cat > /etc/systemd/system/qltb-web.env <<EOF
PORT=${WEB_PORT}
NODE_ENV=production
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
EOF
  chmod 640 /etc/systemd/system/qltb-web.env
  log_ok "qltb-web.env → PORT=${WEB_PORT}"

  cat > /etc/systemd/system/qltb-web.service <<EOF
[Unit]
Description=QLTB Web UI (SvelteKit adapter-node)
After=network.target qltb-api.service
Wants=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${ROOT}/apps/web-ui
ExecStart=${NODE_BIN} ${ROOT}/apps/web-ui/build
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=qltb-web
# Load .env trước (PORT=3000 từ đây bị override bên dưới)
EnvironmentFile=-${ROOT}/.env
# Load web-specific env SAU — PORT=${WEB_PORT} ở đây thắng .env
EnvironmentFile=/etc/systemd/system/qltb-web.env
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
  log_ok "qltb-web.service → port ${WEB_PORT} (localhost only)"
fi

systemctl daemon-reload
systemctl enable qltb-api
systemctl restart qltb-api
log_ok "qltb-api: enabled + started"

if [[ "$OPT_SKIP_WEB" == "false" ]]; then
  systemctl enable qltb-web
  systemctl restart qltb-web
  log_ok "qltb-web: enabled + started"
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 2 — Nginx: cài đặt + cấu hình
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_SKIP_NGINX" == "false" ]]; then
  log_step "BƯỚC 2/3 — Cài đặt và cấu hình nginx"

  # Cài nginx nếu chưa có
  if ! command -v nginx &>/dev/null; then
    log_info "Cài đặt nginx..."
    apt-get update -qq
    apt-get install -y -qq nginx
    log_ok "nginx đã cài đặt: $(nginx -v 2>&1)"
  else
    log_ok "nginx đã có: $(nginx -v 2>&1)"
  fi

  # Xóa default site
  if [[ -L "/etc/nginx/sites-enabled/default" ]]; then
    rm /etc/nginx/sites-enabled/default
    log_info "Đã xóa nginx default site"
  fi

  # adapter-node: static assets trong build/client/, SSR qua Node port WEB_PORT
  STATIC_DIR="${ROOT}/apps/web-ui/build/client"

  cat > "$NGINX_CONF" <<NGINX
# ============================================================
# QLTB — Nginx Reverse Proxy
# Tạo bởi: scripts/setup-service.sh
# Sửa tại: ${NGINX_CONF}
# ============================================================

# Rate limiting chống brute-force / DDoS đơn giản
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone \$binary_remote_addr zone=web_limit:10m rate=60r/s;

# WebSocket upgrade mapping
map \$http_upgrade \$connection_upgrade {
    default  upgrade;
    ''       close;
}

server {
    listen 80;
    server_name ${OPT_DOMAIN};

    server_tokens off;

    # Security headers
    add_header X-Content-Type-Options "nosniff"       always;
    add_header X-Frame-Options        "SAMEORIGIN"    always;
    add_header X-XSS-Protection       "1; mode=block" always;
    add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

    # ── Gzip compression ──────────────────────────────────────────────────────
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/javascript image/svg+xml;
    gzip_min_length 1024;

    # ── Static assets (_app/) — nginx phục vụ trực tiếp, không qua Node ──────
    # SvelteKit đặt hashed assets tại build/client/_app/ → cache vĩnh viễn
    location /_app/ {
        root ${STATIC_DIR};
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        gzip_static on;
        try_files \$uri =404;
    }

    # Favicon, robots.txt
    location ~* ^/(favicon\.(ico|png)|robots\.txt|site\.webmanifest)$ {
        root ${STATIC_DIR};
        expires 30d;
        access_log off;
        try_files \$uri =404;
    }

    # ── API (/api/*) — proxy đến Fastify ─────────────────────────────────────
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host               \$host;
        proxy_set_header X-Real-IP          \$remote_addr;
        proxy_set_header X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  \$scheme;
        proxy_set_header X-Forwarded-Host   \$host;

        client_max_body_size 50M;
        proxy_read_timeout   120s;
        proxy_send_timeout   120s;

        add_header Cache-Control "no-store" always;
    }

    # ── Swagger UI (/docs) — proxy đến Fastify ───────────────────────────────
    location /docs {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host               \$host;
        proxy_set_header X-Real-IP          \$remote_addr;
        proxy_set_header X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  \$scheme;
        proxy_set_header X-Forwarded-Host   \$host;
        add_header Cache-Control "no-store" always;
    }

    # ── Web UI — proxy đến SvelteKit Node server ──────────────────────────────
    location / {
        limit_req zone=web_limit burst=100 nodelay;

        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host               \$host;
        proxy_set_header X-Real-IP          \$remote_addr;
        proxy_set_header X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  \$scheme;
        proxy_set_header X-Forwarded-Host   \$host;
        proxy_set_header Upgrade            \$http_upgrade;
        proxy_set_header Connection         \$connection_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX

  # Enable site
  if [[ ! -L "$NGINX_ENABLED" ]]; then
    ln -s "$NGINX_CONF" "$NGINX_ENABLED"
    log_ok "Site enabled"
  fi

  # Test config
  if nginx -t 2>/dev/null; then
    systemctl enable nginx
    systemctl reload nginx
    log_ok "nginx config hợp lệ — reloaded"
  else
    log_error "nginx config lỗi! Kiểm tra thủ công: sudo nginx -t"
    nginx -t
    exit 1
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# BƯỚC 3 — Firewall (UFW)
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OPT_SKIP_FIREWALL" == "false" ]]; then
  log_step "BƯỚC 3/3 — Cấu hình UFW Firewall"

  # Cài UFW nếu chưa có
  if ! command -v ufw &>/dev/null; then
    log_info "Cài đặt ufw..."
    apt-get update -qq
    apt-get install -y -qq ufw
    log_ok "ufw đã cài đặt"
  else
    log_ok "ufw đã có: $(ufw version | head -1)"
  fi

  # Reset về default policies (silent)
  ufw --force reset > /dev/null 2>&1

  # ── Mặc định: chặn tất cả inbound, cho phép outbound ──────────────────────
  ufw default deny incoming  > /dev/null
  ufw default allow outgoing > /dev/null
  log_info "Default policy: deny incoming, allow outgoing"

  # ── SSH — PHẢI allow trước khi enable để không bị lock out ────────────────
  SSH_PORT=$(ss -tlnp | grep sshd | grep -oP ':\K[0-9]+' | head -1 || echo "22")
  ufw allow "${SSH_PORT}/tcp" comment "SSH" > /dev/null
  log_ok "SSH port ${SSH_PORT} — allowed"

  # ── HTTP / HTTPS ───────────────────────────────────────────────────────────
  if command -v nginx &>/dev/null && [[ "$OPT_SKIP_NGINX" == "false" ]]; then
    # Dùng nginx app profile nếu có
    if ufw app list 2>/dev/null | grep -q "Nginx Full"; then
      ufw allow 'Nginx Full' > /dev/null
      log_ok "HTTP 80 + HTTPS 443 — allowed (via 'Nginx Full' profile)"
    else
      ufw allow 80/tcp  comment "HTTP"  > /dev/null
      ufw allow 443/tcp comment "HTTPS" > /dev/null
      log_ok "HTTP 80 + HTTPS 443 — allowed"
    fi
  else
    ufw allow 80/tcp  comment "HTTP"  > /dev/null
    ufw allow 443/tcp comment "HTTPS" > /dev/null
    log_ok "HTTP 80 + HTTPS 443 — allowed"
  fi

  # ── Node ports: chỉ cho phép từ localhost (nginx proxy) ───────────────────
  # Chặn truy cập trực tiếp từ bên ngoài vào Node services
  ufw deny "${API_PORT}/tcp" comment "Block direct access to qltb-api" > /dev/null
  ufw deny "${WEB_PORT}/tcp" comment "Block direct access to qltb-web" > /dev/null
  log_ok "Port ${API_PORT} (qltb-api) — blocked from outside"
  log_ok "Port ${WEB_PORT} (qltb-web) — blocked from outside"

  # ── Enable UFW ─────────────────────────────────────────────────────────────
  ufw --force enable > /dev/null
  log_ok "UFW enabled"

  echo ""
  echo -e "  ${BOLD}UFW status:${RESET}"
  ufw status numbered | sed 's/^/    /'
fi

# ══════════════════════════════════════════════════════════════════════════════
# Kiểm tra trạng thái cuối
# ══════════════════════════════════════════════════════════════════════════════
log_step "Trạng thái tổng hợp"
sleep 2

_svc_status() {
  local s; s=$(systemctl is-active "$1" 2>/dev/null || echo "unknown")
  [[ "$s" == "active" ]] \
    && echo -e "  $1 : ${GREEN}● active${RESET}" \
    || echo -e "  $1 : ${RED}✗ ${s}${RESET}"
}

_svc_status qltb-api
[[ "$OPT_SKIP_WEB" == "false" ]]   && _svc_status qltb-web
[[ "$OPT_SKIP_NGINX" == "false" ]] && _svc_status nginx

# ══════════════════════════════════════════════════════════════════════════════
# Tóm tắt
# ══════════════════════════════════════════════════════════════════════════════
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "server-ip")

hr
echo -e "\n${BOLD}${GREEN}  ✅  Cài đặt hoàn tất!${RESET}\n"

if [[ "$OPT_SKIP_NGINX" == "false" ]]; then
  if [[ "$OPT_DOMAIN" == "_" ]]; then
    echo -e "  Truy cập: ${CYAN}http://${SERVER_IP}${RESET}"
  else
    echo -e "  Truy cập: ${CYAN}http://${OPT_DOMAIN}${RESET}"
  fi
  echo ""
fi

echo -e "  ${BOLD}Xem log realtime:${RESET}"
echo -e "    ${CYAN}journalctl -u qltb-api -f${RESET}"
[[ "$OPT_SKIP_WEB" == "false" ]] && \
echo -e "    ${CYAN}journalctl -u qltb-web -f${RESET}"
echo ""

echo -e "  ${BOLD}Workflow deploy sau này:${RESET}"
echo -e "    ${CYAN}git pull${RESET}"
echo -e "    ${CYAN}bash scripts/deploy.sh --migrate --restart${RESET}"
echo ""

echo -e "  ${BOLD}Quản lý service:${RESET}"
echo -e "    ${CYAN}sudo systemctl restart qltb-api${RESET}"
echo -e "    ${CYAN}sudo systemctl restart qltb-web${RESET}"
echo -e "    ${CYAN}sudo systemctl status  qltb-api${RESET}"
echo ""

if [[ "$OPT_SKIP_NGINX" == "false" ]]; then
  echo -e "  ${BOLD}HTTPS (Certbot — sau khi có domain trỏ về server):${RESET}"
  echo -e "    ${CYAN}sudo apt install certbot python3-certbot-nginx${RESET}"
  echo -e "    ${CYAN}sudo certbot --nginx -d ${OPT_DOMAIN}${RESET}"
  echo ""
fi

echo -e "  ${BOLD}Gỡ cài đặt:${RESET}"
echo -e "    ${CYAN}sudo bash scripts/setup-service.sh --remove${RESET}"
echo ""
hr
