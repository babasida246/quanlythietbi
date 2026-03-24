# Database Guide - QLTB

Tai lieu nay dinh nghia cac nguyen tac quan tri schema va du lieu nen trong QLTB.

## 1. Database stack

- Engine: PostgreSQL 16
- Driver: `pg`
- Runtime access: repository layer trong `packages/infra-postgres`

## 2. Nguon schema va migration

Schema duoc tao qua 2 cum migration:

1. Base + package migrations:
   - `packages/infra-postgres/src/schema.sql`
   - `packages/infra-postgres/src/migrations/*`
2. App-level migrations:
   - `db/migrations/*.sql`

Cac migration patch theo ngay duoc dat ten dang:

- `YYYYMMDD_NNN_description.sql`

## 3. Thu tu chay migration

Lenh `pnpm db:migrate` chay theo thu tu:

1. Base schema
2. Package migrations
3. App migrations theo ten file tang dan
4. Dated patch migrations theo ten file tang dan

## 4. Quy tac migration bat buoc

- Chi DDL trong migration (CREATE/ALTER/DROP/index/constraint)
- Khong dat seed data trong migration
- Khong sua file migration da merge
- Luon them migration moi de sua schema
- Migration phai idempotent khi co the (`IF EXISTS` / `IF NOT EXISTS` / `DO $$ ... $$`)

## 5. Quy tac dat ten migration

De xuat:

- Numbered migration: `058_add_asset_tracking_columns.sql`
- Dated patch: `20260323_001_fix_assignment_fk.sql`

Dat ten can mo ta ro muc tieu business/technical.

## 6. Seed data strategy

Seed tach rieng tai `db/seed-*.sql`.

Muc tieu seed:

- Khoi tao users/roles/catalogs co ban
- Tao du lieu demo phuc vu test nghiep vu
- Ho tro setup nhanh local va e2e environment

Lenh lien quan:

```bash
pnpm db:seed
pnpm db:reset
```

`pnpm db:reset` = `db:empty` -> `db:migrate` -> `db:seed`.

## 7. Default data sau seed

Thong tin thuong dung:

- Admin: `admin@example.com`
- IT manager: `it_manager@example.com`
- User: `user@example.com`

Mac dinh password theo seed scripts hien hanh.

## 8. Operational workflows

### Khoi tao moi local DB

```bash
pnpm dev:infra
pnpm db:reset
```

### Them schema change an toan

1. Tao migration moi trong `db/migrations/`
2. Viet DDL idempotent
3. Chay `pnpm db:migrate`
4. Chay test lien quan
5. Cap nhat docs neu thay doi nghiep vu/data contract

### Kiem tra migration khong gay vo

- Chay migrate tren DB trong
- Chay migrate lan 2 de check idempotency (neu migration support)
- Chay smoke/API tests lien quan

## 9. SQL quality conventions

- Uu tien explicit columns trong `INSERT` va `SELECT`
- Dat ten FK/index theo convention de de truy vet
- Han che schema drift: moi thay doi DB phai qua migration
- Neu can backfill data, dung script rieng co review/rollback plan

## 10. Backup and restore (recommendation)

Production operations nen co:

- Daily logical backup (`pg_dump`)
- Backup retention policy
- Restore drill dinh ky tren environment test

## 11. Common pitfalls

- Sua migration cu thay vi them migration moi
- Tron seed data vao migration
- Bo qua update contracts/API khi doi schema
- Tao migration khong co guard condition dan den fail khi deploy lap lai

## 12. Review checklist cho PR co DB change

- Co migration file moi chua?
- Migration co ro muc dich va idempotent guard chua?
- Co can seed/update demo data khong?
- Test lien quan da chay chua?
- Docs/API/contracts da duoc cap nhat chua?
