# Deployment

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- PostgreSQL + Redis available

## Environment

Copy template:

```bash
cp .env.example .env
```

Production tham chieu them:

- [../.env.production.example](../.env.production.example)

Mandatory values:

- `DATABASE_URL` hoac `POSTGRES_*`
- `REDIS_URL` hoac `REDIS_*`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `VITE_API_BASE` (set truoc khi build web)

## Build Modes

### 1) Standard

```bash
pnpm install
pnpm build
```

### 2) Production-focused

```bash
pnpm build:prod
```

### 3) Docker app-only

```bash
docker-compose -f docker-compose.app.yml up -d --build
```

### 3.1) Docker app-only with Nginx + Certbot (HTTPS)

Prerequisites:

- Domain `A` record tro ve IP server
- Port `80` va `443` mo tren firewall
- Dien bien moi truong trong `.env`:
  - `QLTB_DOMAIN`
  - `LETSENCRYPT_EMAIL`
  - `LETSENCRYPT_STAGING=false` (production)

Start stack:

```bash
docker-compose -f docker-compose.app.yml up -d --build
```

Giai doan cap cert:

- Nginx bat dau o che do HTTP-only neu chua co cert
- Certbot tu dong request cert qua webroot challenge
- Sau khi co cert, certbot gui `HUP` de nginx reload va kich hoat HTTPS config

Ket qua:

- HTTP (`:80`) tu dong redirect sang HTTPS
- HTTPS (`:443`) proxy den:
  - `/api/*`, `/docs`, `/health` -> `api:3000`
  - route con lai -> `web-ui:3001`

Renew cert:

- Certbot chay vong lap, renew theo `CERTBOT_RENEW_INTERVAL_SECONDS`
- Sau renew thanh cong, nginx duoc reload tu dong

### 4) Full stack docker

```bash
docker-compose up -d --build
```

## Deploy Scripts

Root scripts (see [../package.json](../package.json)):

- `pnpm deploy`
- `pnpm deploy:migrate`
- `pnpm deploy:update`
- `pnpm deploy:fresh`
- `pnpm deploy:docker`

Native Ubuntu HTTPS tu deploy script:

- `bash scripts/deploy.sh --setup-https`
- `bash scripts/deploy.sh --setup-https --https-staging`

Khi bat `--setup-https`, script se:

- cai `certbot` va `python3-certbot-nginx`
- tao/cap nhat nginx server block cho domain `QLTB_DOMAIN`
- chay `certbot --nginx --redirect`
- bat auto-renew qua `certbot.timer`

## Health Checks

- API health route used by tooling: `/health`
- Swagger: `/docs`

## Notes

VITE env vars la build-time values. Neu doi domain API, can rebuild web bundle.
