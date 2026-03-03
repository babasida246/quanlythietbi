# Prune Scope: Keep MY + ASSETS

## Keep

### Web Routes (UI)
- `/me/assets`
- `/me/requests`
- `/notifications`
- `/inbox`
- `/inbox/:id`
- `/assets`
- `/assets/catalogs`
- `/cmdb`
- `/inventory`
- `/warehouse/stock`
- `/maintenance`
- `/requests`
- `/reports/assets`
- `/warehouse/reports`
- Supporting routes still used by kept features:
- `/assets/:id`
- `/requests/new`
- `/requests/:id`
- `/inventory/:id`
- `/cmdb/cis`
- `/cmdb/cis/:id`
- `/cmdb/services`
- `/cmdb/types`
- `/warehouse`
- `/warehouse/warehouses`
- `/warehouse/parts`
- `/warehouse/ledger`
- `/warehouse/documents`
- `/warehouse/documents/new`
- `/warehouse/documents/:id`
- `/login`
- `/setup`
- `/logout`
- `/forbidden`

### API Modules/Endpoints
- Auth: `/api/v1/auth/*`
- Setup: `/api/setup/*`
- Assets/Catalogs/Attachments/Import/Category Specs: `/api/v1/assets*`
- Maintenance: `/api/v1/maintenance*`
- Inventory: `/api/v1/inventory*`
- Warehouse + Stock Documents: `/api/v1/warehouse*`, `/api/v1/stock-documents*`
- CMDB: `/api/v1/cmdb*`
- Requests/Workflow: `/api/v1/workflow*`
- Reports: `/api/v1/reports*`, `/api/v1/assets/reminders*`
- Added lightweight scope endpoints:
- `/api/v1/notifications`
- `/api/v1/notifications/:id/read`
- `/api/v1/inbox`
- `/api/v1/inbox/:id`
- `/api/v1/inbox/:id/reply`

### DB Objects
- Keep existing schema used by assets/warehouse/cmdb/inventory/workflow/reports/auth/setup.
- No destructive DB table drops in this prune step.

## Remove

### Web UI
- Navigation groups removed from sidebar:
- `MAIN` (Chat/Stats/Models)
- `NETOPS` (Devices/Changes/Rulepacks/Field Kit/Tools)
- `SUPPORT` (Help/Profile)
- `ADMIN` section shortcuts
- Routes removed:
- `/chat`
- Legacy routes now redirected to `/me/assets`:
- `/profile`, `/chat`, `/stats`, `/models`, `/devices`, `/changes`, `/rulepacks`, `/field-kit`, `/tools`, `/help`, `/admin/*`, `/netops/*`

### API
- Chat module registration removed from app bootstrap.
- Chat routes removed from API codebase (`/api/v1/chat/*`).
- Chat setup permissions no longer inserted during setup bootstrap.

### Tests/Clients/Features (scope cleanup target)
- Tests and client modules for chat/tools/netops/admin-only surfaces are out-of-scope and replaced by MY+ASSETS focused tests.
