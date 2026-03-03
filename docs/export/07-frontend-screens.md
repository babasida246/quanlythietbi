# 07 - Frontend Screens

## Muc luc
- [1. Tong quan routing UI](#1-tong-quan-routing-ui)
- [2. Danh sach man hinh theo nhom](#2-danh-sach-man-hinh-theo-nhom)
- [3. Mapping screen -> API calls](#3-mapping-screen---api-calls)
- [4. State management va API client](#4-state-management-va-api-client)
- [5. RBAC UI](#5-rbac-ui)
- [6. Evidence](#6-evidence)

## 1. Tong quan routing UI
Frontend dung SvelteKit route-based pages. Trang root redirect theo capability role.

Diem chinh:
- `+layout.ts` tat SSR/prerender.
- `+layout.svelte` thuc hien:
- check auth client-side.
- route guard (`isRouteAllowed`).
- hide/show menu theo capability.
- redirect `/forbidden` neu role khong hop le.

## 2. Danh sach man hinh theo nhom
### 2.1 Public/system
- `/login`
- `/logout`
- `/setup`
- `/forbidden`
- `/notifications`
- `/inbox`
- `/inbox/[id]`

### 2.2 Tai san va nghiep vu tai san
- `/me/assets`
- `/me/requests`
- `/assets`
- `/assets/[id]`
- `/assets/catalogs`
- `/maintenance`
- `/inventory`
- `/inventory/[id]`
- `/requests`
- `/requests/new`
- `/requests/[id]`
- `/reports/assets`

### 2.3 Kho vat tu
- `/warehouse`
- `/warehouse/stock`
- `/warehouse/warehouses`
- `/warehouse/parts`
- `/warehouse/documents`
- `/warehouse/documents/new`
- `/warehouse/documents/[id]`
- `/warehouse/ledger`
- `/warehouse/reports`

### 2.4 CMDB
- `/cmdb` (tabs: CIs, Types, Relationship Types, Services, Topology)
- `/cmdb/cis`
- `/cmdb/cis/[id]`
- `/cmdb/types`
- `/cmdb/services`
- `/cmdb/reports`

### 2.5 QLTS bo sung
- `/assets/purchase-plans`
- `/assets/purchase-plans/new`
- `/assets/asset-increases/new`

## 3. Mapping screen -> API calls
| Screen | Muc dich UI | API client/calls |
|---|---|---|
| `/login` | Dang nhap | `$lib/api/auth.login` |
| `/notifications` | Danh sach + mark read thong bao | `$lib/api/communications.listNotifications`, `markNotificationRead` |
| `/inbox`, `/inbox/[id]` | Danh sach hoi thoai + thread + reply | `$lib/api/communications.listInbox`, `getInboxThread`, `sendInboxReply` |
| `/setup` | Wizard setup/migrate/seed/admin/finalize | `$lib/api/setup` |
| `/assets` | List/search/filter assets + status counts | `$lib/api/assets.listAssets`, `getAssetStatusCounts`, `exportAssets` |
| `/assets/[id]` | Detail asset + timeline + assignment + maintenance + attachments | `$lib/api/assets`, `$lib/api/assetMgmt`, `$lib/api/assetCatalogs` |
| `/assets/catalogs` | Quan ly catalogs + specs | `$lib/api/assetCatalogs` |
| `/maintenance` | Danh sach + tao ticket | `$lib/api/assetMgmt.listMaintenanceTickets`, `$lib/api/assets.openMaintenanceTicket` |
| `/inventory` | Tao/list inventory sessions | `$lib/api/assetMgmt.listInventorySessions`, `createInventorySession` |
| `/inventory/[id]` | Scan/close/report inventory session | `$lib/api/assetMgmt.getInventorySessionDetail`, `scanInventoryAsset`, `closeInventorySession`, `getInventoryReport` |
| `/requests`, `/me/requests` | Danh sach workflow requests | `$lib/api/assetMgmt.listWorkflowRequests` |
| `/requests/[id]`, `/requests/new` | Detail/tao/approve/reject/execute request | `$lib/api/assetMgmt.getWorkflowRequest`, `createWorkflowRequest`, `approveWorkflowRequest`, `rejectWorkflowRequest`, `executeWorkflowRequest` |
| `/warehouse/warehouses` | CRUD kho | `$lib/api/warehouse.listWarehouses`, `createWarehouse`, `updateWarehouse`, `deleteWarehouse` |
| `/warehouse/parts` | CRUD spare parts | `$lib/api/warehouse.listSpareParts`, `createSparePart`, `updateSparePart`, `deleteSparePart` |
| `/warehouse/stock` | Xem ton kho | `$lib/api/warehouse.listStockView`, `listWarehouses` |
| `/warehouse/documents*` | Tao/list/detail/post/cancel stock docs | `$lib/api/warehouse.listStockDocuments`, `getStockDocument`, `createStockDocument`, `updateStockDocument`, `postStockDocument`, `cancelStockDocument` |
| `/warehouse/ledger` | So cai movement | `$lib/api/warehouse.listStockMovements` |
| `/warehouse/reports` | Bao cao ton kho/valuation | `$lib/api/warehouse.getStockOnHandReport`, `getStockAvailableReport`, `getReorderAlertsReport`, `getFefoLotsReport`, `getValuationReport` |
| `/cmdb` | Dashboard tabs CMDB qua panel components | `$lib/cmdb/*` -> `$lib/api/cmdb` |
| `/cmdb/cis/[id]` | CI detail + relationships tab | `$lib/api/cmdb.getCiDetail` + `CiRelationshipsTab` |
| `/cmdb/reports` | Report + export CMDB | fetch truc tiep `/api/v1/cmdb/reports/*` |
| `/assets/purchase-plans*` | QLTS purchase plans | fetch truc tiep `/api/v1/assets/purchase-plans*` |
| `/assets/asset-increases/new` | QLTS asset increase | fetch truc tiep `/api/v1/assets/asset-increases*` |

## 4. State management va API client
- HTTP client trung tam: `apps/web-ui/src/lib/api/httpClient.ts`.
- Luu token/user trong `localStorage` (`authToken`, `refreshToken`, `userRole`, ...).
- Tu dong refresh token khi `authorizedFetch` gap 401.
- Co in-memory GET cache cho `apiJsonCached/apiJsonDataCached`.

Stores:
- `sessionStore`: writable + persist localStorage cho user/grants.
- `permissionStore`: derive permissions theo context + grants.
- `contextStore`: luu org/warehouse context.

## 5. RBAC UI
- Role -> capability map o `getCapabilities`.
- Menu items co `requires(caps)` de an/hien.
- Route guard dung `isRouteAllowed(pathname, caps)` de redirect forbidden.

## 6. Evidence
- Route inventory (page files): `apps/web-ui/src/routes` (danh sach file route da quet).
- Layout auth/menu guard: `apps/web-ui/src/routes/+layout.svelte:48-159`.
- Root redirect: `apps/web-ui/src/routes/+page.svelte:4-11`.
- Capabilities mapping: `apps/web-ui/src/lib/auth/capabilities.ts:16-31`, `apps/web-ui/src/lib/auth/capabilities.ts:58-94`.
- Page imports API (mau tong hop): `apps/web-ui/src/routes/login/+page.svelte:6`, `apps/web-ui/src/routes/setup/+page.svelte:26`, `apps/web-ui/src/routes/(assets)/assets/+page.svelte:19-20`, `apps/web-ui/src/routes/(assets)/maintenance/+page.svelte:19-20`, `apps/web-ui/src/routes/(assets)/inventory/+page.svelte:6`, `apps/web-ui/src/routes/(assets)/warehouse/stock/+page.svelte:5`.
- Warehouse pages -> API: `apps/web-ui/src/routes/(assets)/warehouse/parts/+page.svelte:5`, `apps/web-ui/src/routes/(assets)/warehouse/documents/+page.svelte:6`, `apps/web-ui/src/routes/(assets)/warehouse/ledger/+page.svelte:5`, `apps/web-ui/src/routes/(assets)/warehouse/reports/+page.svelte:17`.
- CMDB pages/components: `apps/web-ui/src/routes/(assets)/cmdb/+page.svelte:6-10`, `apps/web-ui/src/lib/cmdb/CmdbCisPanel.svelte:5`, `apps/web-ui/src/lib/cmdb/CmdbTypesPanel.svelte:5`, `apps/web-ui/src/lib/cmdb/RelationshipTypesPanel.svelte:13`, `apps/web-ui/src/lib/cmdb/CmdbServicesPanel.svelte:5`, `apps/web-ui/src/lib/cmdb/TopologyGraph.svelte:5`.
- CMDB reports va QLTS direct fetch: `apps/web-ui/src/routes/(assets)/cmdb/reports/+page.svelte:57-71`, `apps/web-ui/src/routes/(assets)/assets/purchase-plans/new/+page.svelte:74-89`, `apps/web-ui/src/routes/(assets)/assets/asset-increases/new/+page.svelte:91-106`.
- API client + token refresh: `apps/web-ui/src/lib/api/httpClient.ts:2-22`, `apps/web-ui/src/lib/api/httpClient.ts:51-84`, `apps/web-ui/src/lib/api/httpClient.ts:147-186`.
- Session/permission/context stores: `apps/web-ui/src/lib/stores/sessionStore.ts:38-78`, `apps/web-ui/src/lib/stores/permissionStore.ts:79-123`, `apps/web-ui/src/lib/stores/contextStore.ts:96-110`.
