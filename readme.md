## Database Migrate + Seed

Use these commands against `DATABASE_URL` (from `.env` or your shell):

```bash
pnpm db:migrate
pnpm db:seed
```

For the assets Docker stack:

```bash
docker compose -f docker/compose.assets.yml exec -T api /app/docker/scripts/migrate-assets.sh
docker compose -f docker/compose.assets.yml exec -T api node /app/packages/infra-postgres/src/seeds/deterministic-seed.mjs
```

## First-time Setup Wizard

With docker-compose running (`postgres`, `api`, `web-ui`, `pgadmin`), open:

```bash
http://localhost:3001/setup
```

Wizard flow:

1. Check API + DB health
2. Run migration
3. Run deterministic seed
4. Create first admin account
5. Finalize setup (locks setup APIs and redirects to `/login`)

After setup is finalized, `POST /api/setup/*` endpoints are blocked by design.
