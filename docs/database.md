# Database

## Execution Scripts

- Migrate: [../scripts/db-migrate.mjs](../scripts/db-migrate.mjs)
- Seed: [../scripts/db-seed.mjs](../scripts/db-seed.mjs)
- Empty/reset helpers: [../scripts/db-empty.mjs](../scripts/db-empty.mjs), [../scripts/db-setup.mjs](../scripts/db-setup.mjs)

## Migration Order

`db-migrate.mjs` chay theo thu tu co dinh:

1. `packages/infra-postgres/src/schema.sql`
2. `packages/infra-postgres/src/migrations/*` (020..042)
3. `db/migrations/*` (007..062 + dated patches)

Script co bang tracking `schema_migrations` va bo qua migration da apply.

## Seed Order

`db-seed.mjs` chay danh sach seed theo thu tu hardcoded (14 files), bat dau tu:

1. `seed-data.sql`
2. `seed-assets-management.sql`
3. `seed-assets.sql`
...
14. `seed-cmdb-config-files.sql`

## Commands

```bash
pnpm db:empty
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

## Environment Inputs

DB scripts dung `.env` / `.env.local` va `DATABASE_URL`.

Neu khong set `DATABASE_URL`, API co the build URL tu `POSTGRES_*` vars trong env parser.
