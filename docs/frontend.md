# Frontend

## Stack

- SvelteKit 2 + Svelte 5 runes
- TailwindCSS
- adapter-node output (`build/`)

Config files:

- [../apps/web-ui/svelte.config.js](../apps/web-ui/svelte.config.js)
- [../apps/web-ui/vite.config.ts](../apps/web-ui/vite.config.ts)
- [../apps/web-ui/tailwind.config.js](../apps/web-ui/tailwind.config.js)

## Routing Shell

Root layout: [../apps/web-ui/src/routes/+layout.svelte](../apps/web-ui/src/routes/+layout.svelte)

- Auth guard
- Sidebar shell
- Permission/effective perms load
- Theme + common UI hosts

Shell-less pages: `login`, `setup`, etc.

## API Client

HTTP layer tai [../apps/web-ui/src/lib/api/httpClient.ts](../apps/web-ui/src/lib/api/httpClient.ts):

- token read/write localStorage
- singleton refresh token on 401
- clear session + redirect login khi refresh fail

## i18n Strategy

i18n register tai [../apps/web-ui/src/lib/i18n/index.ts](../apps/web-ui/src/lib/i18n/index.ts).

Dung split locale files theo domain:

- `locales/vi/common.json`, `assets.json`, `warehouse.json`, ...
- `locales/en/common.json`, `assets.json`, `warehouse.json`, ...

Khong dung file monolithic `vi.json`/`en.json`.

## Theme

Theme tokens va style shared:

- [../apps/web-ui/src/lib/styles/tokens.css](../apps/web-ui/src/lib/styles/tokens.css)
- [../apps/web-ui/src/app.css](../apps/web-ui/src/app.css)

Frontend build:

```bash
pnpm build:web
```

Output: `apps/web-ui/build/`.
