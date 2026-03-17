# QLTB Refactoring Todolist

## Đã hoàn thành

- [x] **P1-A** — Unify enum types: web-ui imports enums từ `@qltb/contracts` thay vì định nghĩa lại
- [x] **P1-B** — Unify RBAC: single permission matrix trong `@qltb/contracts`
- [x] **P1-C** — Migrate self-contained modules ra `packages/` (accessories, audit, checkout, components, consumables, depreciation, licenses, wf)
- [x] **P1-D** — Fix DTO drift: align timestamp types (`Date` → `string`) giữa contracts, infra-postgres, và web-ui
- [x] **P2** — Split `assets.module.ts` thành 6 context factories theo bounded context

---

## Đang chờ

### P3 — `packages/client` typed SDK

**Mục tiêu:** Tạo một package `@qltb/client` chứa toàn bộ HTTP client functions thay cho ~30 file riêng lẻ trong `apps/web-ui/src/lib/api/`.

**Vấn đề hiện tại:**
- Mỗi file trong `web-ui/src/lib/api/` tự unwrap envelope `{ success, data }` theo cách riêng — không nhất quán, dễ sai
- Types trả về là `any` hoặc cast thủ công ở nhiều nơi
- Không có single source of truth cho API contract giữa server và client

**Việc cần làm:**
1. Tạo `packages/client/` với `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Thêm `@qltb/client` vào `pnpm-workspace.yaml` và deps của `@qltb/web-ui`
3. Tạo typed `ApiClient` class hoặc factory function dùng `fetch` + `@qltb/contracts` types
4. Tạo một module function cho mỗi bounded context (assets, cmdb, warehouse, maintenance, inventory, analytics, automation, integrations, security, admin, communications)
5. Chuẩn hóa envelope unwrapping: một helper `unwrap<T>(response)` tại một chỗ
6. Migrate từng `web-ui/src/lib/api/*.ts` sang import từ `@qltb/client` — giữ backward-compatible re-exports để không phải sửa tất cả `.svelte` files cùng lúc
7. Xóa dần các re-export alias khi tất cả Svelte components đã migrate

**Ưu tiên:** Medium — không block tính năng, nhưng giúp type safety và maintainability dài hạn.

**Ghi chú:**
- Làm từng module một (không cần làm tất cả cùng lúc)
- Bắt đầu từ module có nhiều consumers nhất: `assets.ts`, `cmdb.ts`
- Cần tạo mock/test infrastructure nếu muốn viết unit test cho client SDK
