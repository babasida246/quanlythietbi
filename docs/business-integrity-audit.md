# Business Integrity Audit — QuanLyThietBi

**Date:** 2026-03-04  
**Engineer:** Principal Backend + Database Engineering Review  

---

## Executive Summary

Three critical issues were identified and resolved in this audit session:

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Auto-approve bug: every submitted request instantly approved itself | **CRITICAL** | ✅ Fixed |
| 2 | 3 disconnected navigation menus with no data linkage | High | ✅ Fixed |
| 3 | Missing DB integrity constraints (CHECK, trigger, indexes) | Medium | ✅ Fixed |

---

## Issue 1: Auto-Approve Bug (CRITICAL)

### Root Cause

`wf_definitions.request_type` values in the database used **legacy identifiers** that did not match the `WfRequestType` enum defined in `packages/contracts/src/workflow/index.ts`.

**Database state (before fix):**
```
wf-purchase-plan → purchase_plan   ← WRONG
wf-asset-issue   → asset_issue     ← WRONG
wf-asset-dispose → asset_dispose   ← WRONG
wf-repair-order  → repair_order    ← WRONG
```

**Code enum (contracts):**
```typescript
type WfRequestType = 'asset_request' | 'repair_request' | 'disposal_request' | 'purchase' | 'other'
```

When `wf.service.ts::submitRequest()` called `findDefinitionByType(req.requestType)`, it returned `null` because no definition matched. The fallback at lines 116–128 then auto-approved the request:

```typescript
const def = await this.repo.findDefinitionByType(req.requestType);
if (!def || !def.steps.length) {
  // ← This branch always triggered → instant approval
  await this.repo.updateRequestStatus(..., 'approved', ...);
  return updated!;
}
```

### Fix Applied

**Migration `db/migrations/20260304_001_fix_wf_definitions_request_types.sql`:**

```
purchase_plan  → purchase
asset_issue    → asset_request
asset_dispose  → disposal_request
repair_order   → repair_request
```

Also fixed all `wf_requests` rows that contained legacy type values, and added a new `wf-other` definition for the `other` type.

**Seed files updated:**
- `db/seed-qlts-demo.sql` — `wf_definitions` and `wf_requests` inserts
- `db/seed-workflows.sql` — `wf_requests` inserts

**Result:** `findDefinitionByType()` now returns the correct workflow definition, so requests proceed through the multi-step approval flow as intended.

---

## Issue 2: Disconnected Navigation Menus

### Root Cause

The sidebar contained 3 separate, disconnected menu entries pointing to 3 separate pages:
- `myItems`: `/me/requests` (nav.myRequests)
- `myItems`: `/inbox` (nav.inbox)
- `assetItems`: `/requests` (nav.requests)

These pages were functionally related (all part of the workflow request system) but required users to navigate between 3 different pages to manage the complete request lifecycle.

### Fix Applied

**`apps/web-ui/src/routes/(assets)/requests/+page.svelte`** — completely rewritten as a unified page with 3 tabs:

| Tab | URL param | Content | Badge |
|-----|-----------|---------|-------|
| Của tôi | `?tab=mine` (default) | My requests — with create/submit/cancel/withdraw | — |
| Hộp duyệt | `?tab=inbox` | Pending approvals assigned to me — with approve/reject/claim | 🔴 pending count |
| Tất cả | `?tab=all` | All requests (admin view) | — |

**`apps/web-ui/src/lib/components/AppSidebar.svelte`** — consolidated:
- Removed `/me/requests` and `/inbox` from `myItems`
- Removed `/requests` from `assetItems`
- Added single `/requests` entry in `myItems` with match function covering old paths

**Redirects added** (backwards compatibility):
- `apps/web-ui/src/routes/inbox/+page.ts` → redirects to `/requests?tab=inbox`
- `apps/web-ui/src/routes/(assets)/me/requests/+page.ts` → redirects to `/requests?tab=mine`

---

## Issue 3: Database Integrity Constraints

### Missing Constraints Found

Before this audit the following integrity gaps existed:

| Category | Gap | Risk |
|----------|-----|------|
| `wf_definitions.request_type` | No CHECK on enum values | New seed data could reintroduce bug |
| `wf_requests.request_type` | No CHECK on enum values | API could save invalid types |
| `wf_approvals` | No constraint preventing duplicate approved per step | Race condition could double-approve |
| `stock_documents` | No state machine enforcement | Could skip submitted→approved step |

### Fix Applied

**Migration `db/migrations/20260304_002_business_integrity_constraints.sql`:**

1. **CHECK constraint** on `wf_definitions.request_type`:
   ```sql
   CHECK (request_type IN ('asset_request','repair_request','disposal_request','purchase','other'))
   ```

2. **CHECK constraint** on `wf_requests.request_type` (same set)

3. **Unique partial index** to prevent double-approval per step:
   ```sql
   CREATE UNIQUE INDEX uidx_wf_approvals_one_approved_per_step
       ON wf_approvals (request_id, step_no)
       WHERE status = 'approved';
   ```

4. **State machine trigger** on `stock_documents`:
   ```
   Valid transitions:
     draft → submitted
     draft → canceled
     submitted → approved
     submitted → canceled
     approved → posted
     approved → canceled
   ```
   Any attempt to skip (e.g., `draft → posted`) raises an exception.

5. **Performance indexes:**
   - `idx_wf_requests_requester_status` (composite for "my requests" query)
   - `idx_wf_approvals_assignee_pending` (partial index for inbox)
   - `idx_stock_documents_warehouse_status` (warehouse listing)

---

## Warehouse Document Approval Flow

The warehouse document approval flow is **already fully implemented**:

| Layer | Status |
|-------|--------|
| Backend `StockDocumentService` | ✅ `draft→submitted→approved→posted` state machine |
| API routes (`stock-documents.routes.ts`) | ✅ `/submit`, `/approve`, `/post`, `/cancel` endpoints |
| UI `warehouse/documents/[id]` | ✅ Buttons shown contextually per status |
| DB state machine trigger | ✅ Added by migration 002 |

**No additional work required** for warehouse document approval.

---

## Integrity Verification

Run at any time to verify data consistency:

```bash
cat scripts/verify-integrity.sql | docker exec -i qltb-postgres psql -U postgres -d qltb
```

**Current status (verified 2026-03-04):**

```
[ 1 ] WF_DEFINITIONS invalid types:      0 rows ✅
[ 2 ] WF_REQUESTS invalid types:         0 rows ✅
[ 3 ] In-flight requests, no approvals:  0 rows ✅
[ 4 ] Duplicate approved per step:       0 rows ✅
[ 5 ] Orphaned requesters:               0 rows ✅
[ 6 ] Posted docs, no lines:             0 rows ✅
[ 7 ] Lines with qty ≤ 0:                0 rows ✅
[ 8 ] Negative on_hand stock:            0 rows ✅
[ 9 ] Reserved > on_hand:                0 rows ✅
```

---

## Files Changed

| File | Change |
|------|--------|
| `db/migrations/20260304_001_fix_wf_definitions_request_types.sql` | **NEW** — fixes auto-approve bug |
| `db/migrations/20260304_002_business_integrity_constraints.sql` | **NEW** — adds constraints & trigger |
| `db/seed-qlts-demo.sql` | Updated `wf_definitions` and `wf_requests` types |
| `db/seed-workflows.sql` | Updated `wf_requests` types |
| `scripts/verify-integrity.sql` | **NEW** — audit/verify script |
| `apps/web-ui/src/routes/(assets)/requests/+page.svelte` | **REWRITTEN** — unified 3-tab requests page |
| `apps/web-ui/src/routes/inbox/+page.ts` | **NEW** — redirect to `/requests?tab=inbox` |
| `apps/web-ui/src/routes/(assets)/me/requests/+page.ts` | **NEW** — redirect to `/requests?tab=mine` |
| `apps/web-ui/src/lib/components/AppSidebar.svelte` | Consolidated nav items |

---

## Pre-existing Constraints (Already Existed)

These were already in place before this audit:

- `stock_document_lines.qty > 0` CHECK ✅
- `stock_documents.status` valid values CHECK ✅
- `stock_documents.doc_type` valid values CHECK ✅
- `wf_requests.status` valid values CHECK ✅
- `wf_requests.priority` valid values CHECK ✅
- `wf_approvals.status` valid values CHECK ✅
- `spare_part_stock.on_hand >= 0` CHECK ✅
- `spare_part_stock.reserved >= 0` CHECK ✅
- All FK relationships with appropriate ON DELETE behaviour ✅
