# Backend API

## Entry Points

- Main: [../apps/api/src/main.ts](../apps/api/src/main.ts)
- Server startup: [../apps/api/src/core/server.ts](../apps/api/src/core/server.ts)
- App assembly: [../apps/api/src/core/app.ts](../apps/api/src/core/app.ts)

## Environment

Env parser su dung Zod tai [../apps/api/src/config/env.ts](../apps/api/src/config/env.ts).

DB connection co 2 cach:

- `DATABASE_URL`
- Hoac set `POSTGRES_HOST/PORT/DB/USER/PASSWORD` de tu build URL

Redis dung `REDIS_URL` (fallback default local).

## Auth Behavior

Auth hook tai `api-auth.hook.ts` ap dung cho `/api/v1/*` va bo qua:

- `OPTIONS`
- non `/api/v1/*`
- `/api/v1/auth/*`

Login/refresh routes nam trong `routes/v1/auth`.

## Response Convention

Utility response nam trong [../apps/api/src/shared/utils/response.utils.ts](../apps/api/src/shared/utils/response.utils.ts):

- Success: `{ success: true, data, meta? }`
- Error: `{ success: false, error }`

## Main Route Groups

Tham chieu trong [../apps/api/src/routes/v1](../apps/api/src/routes/v1):

- `assets`, `warehouse`, `cmdb`, `maintenance`, `inventory`
- `requests`, `workflow` family
- `analytics`, `reports`, `security`, `admin`, `organizations`
- `integrations`, `automation`, `communications`

Swagger UI default: `/docs`.

## Build

API build su dung tsup config tai [../apps/api/tsup.config.ts](../apps/api/tsup.config.ts).

```bash
pnpm build:api
```

Output: `apps/api/dist/main.js`.
