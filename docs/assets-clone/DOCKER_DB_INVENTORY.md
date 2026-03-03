# Assets Docker + DB Inventory (Source -> QuanLyThietBi)

## Source assets stack (read-only survey)

### Containers and roles
- postgres: primary database for gateway + assets data
- redis: cache/session storage for API
- gateway-api: API service (assets + CMDB + workflow)
- gateway-mcp: MCP service
- web-ui: Svelte web UI
- pgadmin: PostgreSQL admin UI
- redisinsight: Redis admin UI
- nginx: optional reverse proxy

### Ports
- postgres: 5432
- redis: 6379
- gateway-api: 3000
- gateway-mcp: 3001
- web-ui: 3003
- pgadmin: 5050
- redisinsight: 5540
- nginx: 80/443 (profile: proxy)

### Networks and volumes
- network: netopsai-gateway-network
- volumes: postgres_data, redis_data, pgadmin_data, redisinsight_data

### Entrypoints and healthchecks
- postgres: pg_isready
- gateway-api: GET http://0.0.0.0:3000/health
- gateway-mcp: none
- web-ui: no healthcheck

### DB schema and migrations
- packages/infra-postgres/src/schema.sql (full schema dump)
- packages/infra-postgres/src/migrations/* (assets + CMDB migrations)
- db/migrations/* (assets modules: licenses, accessories, consumables, components, checkout, requests, audit, labels, depreciation, reports)

### Seeds
- db/seed-data.sql (base data)
- db/seed-assets-management.sql (assets module seed)
- db/seed-all.sql (combined demo seed)

### DB tooling and scripts
- scripts/run-migrations.ts: applies schema.sql via pg client
- scripts/seed-assets.ts: programmatic seed helper
- docker entrypoint init: db/init scripts mounted to /docker-entrypoint-initdb.d

### Env keys observed
- DATABASE_URL
- POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_PORT
- REDIS_URL, REDIS_PASSWORD
- JWT_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
- ENCRYPTION_KEY
- OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
- ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
- LOG_LEVEL

## QuanLyThietBi assets clone (new)

### Compose and scripts
- docker/compose.assets.yml
- docker/scripts/wait-for-db.sh
- docker/scripts/migrate-assets.sh
- docker/scripts/seed-assets.sh
- docker/scripts/reset-assets.sh

### DB and seed bundles
- packages/infra-postgres/src/migrations/assets/000_assets_bundle.sql
- packages/infra-postgres/src/seeds/assets/000_assets_seed_bundle.sql

### Env templates
- .env.assets.example
- docker/env/.env.assets.dev.example

### Service naming and isolation
- network: qltb_assets_net
- volumes: qltb_assets_pgdata, qltb_assets_pgadmin_data
- container_name prefix: qltb_assets_*

### Healthchecks
- db: pg_isready
- api: GET /health/ready
