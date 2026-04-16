# Deployment

## 1. Yêu cầu

- Node.js >= 20
- pnpm >= 8
- PostgreSQL 16 + Redis

## 2. Biến môi trường

Sao chép template:

```bash
cp .env.example .env
```

Bắt buộc cho production:

| Biến | Mô tả |
| --- | --- |
| `DATABASE_URL` hoặc `POSTGRES_*` | Kết nối PostgreSQL |
| `REDIS_URL` hoặc `REDIS_*` | Kết nối Redis |
| `JWT_SECRET` | Khóa ký access token |
| `JWT_REFRESH_SECRET` | Khóa ký refresh token |
| `VITE_API_BASE` | Base URL frontend → API (set **trước** khi build web) |

Tham khảo thêm: [.env.production.example](../.env.production.example)

> **Lưu ý**: `VITE_API_BASE` là build-time variable của Vite. Nếu đổi domain API sau khi đã build, cần rebuild lại web bundle.

## 3. Build

### Standard

```bash
pnpm install
pnpm build
```

### Production-optimized

```bash
pnpm build:prod
```

### Docker (app only)

```bash
docker-compose -f docker-compose.app.yml up -d --build
```

### Docker (full stack — app + PostgreSQL + Redis)

```bash
docker-compose up -d --build
```

## 4. Docker + HTTPS (Nginx + Certbot)

### Yêu cầu

- DNS `A` record của domain trỏ đúng IP server
- Port `80` và `443` mở trên firewall
- Điền trong `.env`:

```env
QLTB_DOMAIN=yourdomain.com
LETSENCRYPT_EMAIL=admin@yourdomain.com
LETSENCRYPT_STAGING=false
```

### Khởi động

```bash
docker-compose -f docker-compose.app.yml up -d --build
```

### Cơ chế cấp cert

1. Nginx khởi động ở HTTP-only nếu chưa có cert.
2. Certbot request cert qua webroot challenge.
3. Sau khi có cert, certbot gửi `HUP` để nginx reload và kích hoạt HTTPS config.
4. HTTP (`:80`) tự động redirect sang HTTPS.

### Routing qua Nginx

| Path | Destination |
| --- | --- |
| `/api/*`, `/docs`, `/health` | `api:3000` |
| Còn lại | `web-ui:3001` |

### Renew cert

Certbot chạy vòng lặp renew theo `CERTBOT_RENEW_INTERVAL_SECONDS`. Sau renew thành công, nginx reload tự động.

## 5. Deploy scripts (Ubuntu native)

```bash
pnpm deploy             # Basic deploy
pnpm deploy:migrate     # Deploy + chạy migrations
pnpm deploy:update      # Deploy + migrate + restart service
pnpm deploy:fresh       # Deploy + migrate + seed + HTTPS setup
```

Thiết lập HTTPS trên Ubuntu (Let's Encrypt hoặc self-signed):

```bash
bash scripts/deploy.sh --setup-https
bash scripts/deploy.sh --setup-https --https-staging   # dùng Let's Encrypt staging
```

Khi `QLTB_DOMAIN` là domain local/private (localhost, *.local, TLD không hợp lệ), script tự động tạo **self-signed certificate** bằng `openssl` — không gọi Let's Encrypt.

## 6. Health checks

| Endpoint | Mô tả |
| --- | --- |
| `GET /health` | API health check (dùng bởi Docker + tooling) |
| `GET /docs` | Swagger UI |

## 7. Database sau deploy

```bash
# Chạy migrations mới
pnpm db:migrate

# Full reset (development only)
pnpm db:reset
```
