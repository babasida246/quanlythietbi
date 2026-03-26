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

## Health Checks

- API health route used by tooling: `/health`
- Swagger: `/docs`

## Notes

VITE env vars la build-time values. Neu doi domain API, can rebuild web bundle.
