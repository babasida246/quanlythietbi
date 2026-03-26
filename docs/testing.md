# Testing

## Test Stack

- Playwright: API + UI E2E
- Vitest: unit tests trong packages/apps

Main config files:

- [../playwright.config.ts](../playwright.config.ts)
- [../vitest.config.ts](../vitest.config.ts)

## Playwright Projects

Trong config hien tai:

- `api` project -> `tests/api`
- `chromium` project -> `tests/ui`

Web servers auto-start khi can:

- API dev server
- Web vite dev server

Default test base ports:

- API: `4010`
- Web: `4011`

## Commands

```bash
pnpm test
pnpm test:e2e
pnpm test:api
pnpm test:ui
pnpm test:smoke
pnpm test:all
```

## Reports

Playwright reporters configured:

- list
- html (`playwright-report`)
- json (`playwright-report/results.json`)

## Useful Workflow

```bash
# Lint + type + unit
pnpm test:lint
pnpm test:typecheck
pnpm test

# E2E
pnpm test:e2e
pnpm test:report
```
