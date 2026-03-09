#!/usr/bin/env python3
"""
deploy-server.py — Tự động deploy QuanLyThietBi lên server Linux qua SSH.

Cách dùng:
  python scripts/deploy-server.py

Yêu cầu:
  pip install paramiko
"""

import paramiko
import sys
import time

# ─── Cấu hình kết nối ──────────────────────────────────────────────────────
HOST     = "172.251.96.30"
PORT     = 22
USER     = "bvqy121"
PASSWORD = "Benhvien@121"
REPO_DIR = "/home/bvqy121/quanlythietbi"

# ─── Cấu hình .env production ──────────────────────────────────────────────
# Note: Passwords không dùng ký tự @ để tránh phá vỡ URL parsing
ENV_CONTENT = """NODE_ENV=production
HOST=0.0.0.0
PORT=3000
WEB_PORT=3001

# PostgreSQL
POSTGRES_DB=qltb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=PostgresBVQY2026!
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:PostgresBVQY2026!@postgres:5432/qltb
DATABASE_POOL_MAX=20

# Redis
REDIS_PASSWORD=RedisBVQY2026!
REDIS_PORT=6379
REDIS_URL=redis://:RedisBVQY2026!@redis:6379
REDIS_CACHE_ENABLED=true
REDIS_CACHE_TTL=900

# Migrations
RUN_MIGRATIONS=true

# JWT Secrets
JWT_ACCESS_SECRET=bvqy-access-secret-quanlythietbi-2026-production
JWT_REFRESH_SECRET=bvqy-refresh-secret-quanlythietbi-2026-production
DISABLE_AUTH=false

# Frontend
VITE_API_BASE=http://172.251.96.30:3000/api
VITE_API_URL=http://172.251.96.30:3000/api
BACKEND_BASE_URL=http://api:3000/api

# Logging & Rate limit
LOG_LEVEL=warn
ENABLE_RATE_LIMIT=true
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
"""

def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    """Chạy lệnh SSH và in output realtime."""
    print(f"\n$ {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out_lines = []
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line, end="", flush=True)
        out_lines.append(line)
    exit_code = stdout.channel.recv_exit_status()
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print(f"[stderr] {err.strip()}")
    return exit_code, "".join(out_lines), err


def run_sudo(ssh: paramiko.SSHClient, cmd: str, timeout: int = 300) -> int:
    """Chạy lệnh với sudo, tự cung cấp password."""
    return run(ssh, f"echo '{PASSWORD}' | sudo -S {cmd}", timeout)[0]


def main():
    print("=" * 60)
    print("  QuanLyThietBi — Auto Deploy Script")
    print(f"  Server: {USER}@{HOST}")
    print("=" * 60)

    # ── Kết nối SSH ──────────────────────────────────────────────
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"\n[1/8] Kết nối SSH đến {HOST}...")
    try:
        ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD,
                    timeout=30, banner_timeout=60)
        print("      ✓ Kết nối thành công!")
    except Exception as e:
        print(f"      ✗ Kết nối thất bại: {e}")
        sys.exit(1)

    # ── Cập nhật hệ thống ────────────────────────────────────────
    print("\n[2/8] Cập nhật apt và cài dependencies...")
    run_sudo(ssh, "apt-get update -qq", timeout=120)
    run_sudo(ssh, "apt-get install -y -qq curl git ca-certificates gnupg", timeout=120)

    # ── Cài Docker ───────────────────────────────────────────────
    print("\n[3/8] Kiểm tra / cài Docker...")
    rc, out, _ = run(ssh, "docker --version 2>/dev/null")
    if rc != 0:
        print("      Docker chưa có, đang cài...")
        run(ssh, "curl -fsSL https://get.docker.com -o /tmp/get-docker.sh", timeout=60)
        run_sudo(ssh, "sh /tmp/get-docker.sh", timeout=300)
        run_sudo(ssh, f"usermod -aG docker {USER}", timeout=30)
        print("      ✓ Docker đã cài xong!")
    else:
        print(f"      ✓ Docker đã có: {out.strip()}")

    # ── Kiểm tra Docker Compose ──────────────────────────────────
    run(ssh, "docker compose version")

    # ── Đồng bộ thời gian server (ảnh hưởng tới GPG trong Docker build) ──
    run_sudo(ssh, "chronyc makestep 2>/dev/null || ntpdate pool.ntp.org 2>/dev/null || true", timeout=30)

    # ── Sửa ownership thư mục repo ──────────────────────────────
    print(f"\n[4/8] Sửa ownership và pull code mới nhất...")
    run_sudo(ssh, f"chown -R {USER}:{USER} {REPO_DIR}", timeout=30)
    run(ssh, f"git config --global --add safe.directory {REPO_DIR}", timeout=10)
    run(ssh, f"cd {REPO_DIR} && git fetch origin && git reset --hard origin/main && git pull origin main", timeout=120)

    # ── Tạo file .env qua SFTP ───────────────────────────────────
    print("\n[5/8] Tạo file .env production...")
    sftp = ssh.open_sftp()
    with sftp.file(f"{REPO_DIR}/.env", "w") as f:
        f.write(ENV_CONTENT)
    sftp.close()
    print("      ✓ .env đã tạo!")

    # ── Docker build & up ────────────────────────────────────────
    print("\n[6/8] Build Docker images (lần đầu có thể mất 5-10 phút)...")
    dc_cmd = f"cd {REPO_DIR} && docker compose"

    # Pull base images mới nhất trước khi build (tránh lỗi GPG outdated keys)
    run(ssh, "docker pull node:20-bookworm-slim", timeout=300)

    rc, _, _ = run(ssh, f"{dc_cmd} build --no-cache", timeout=900)
    if rc != 0:
        print("      ✗ Build thất bại! Xem log bên trên.")
        ssh.close()
        sys.exit(1)

    # ── Khởi động services ───────────────────────────────────────
    print("\n[7/8] Khởi động tất cả services (postgres, redis, api, web-ui)...")
    run(ssh, f"{dc_cmd} down --remove-orphans", timeout=60)
    run(ssh, f"{dc_cmd} up -d", timeout=120)

    # ── Kiểm tra trạng thái ──────────────────────────────────────
    print("\n[8/8] Kiểm tra trạng thái containers...")
    time.sleep(10)  # Đợi containers khởi động
    run(ssh, f"{dc_cmd} ps", timeout=30)
    run(ssh, f"{dc_cmd} logs --tail=30 api", timeout=30)

    print("\n" + "=" * 60)
    print("  DEPLOY HOÀN TẤT!")
    print(f"  API:    http://{HOST}:3000")
    print(f"  Web UI: http://{HOST}:3001")
    print("=" * 60)

    ssh.close()


if __name__ == "__main__":
    main()
