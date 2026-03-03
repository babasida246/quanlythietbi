# CI/CD Scripts

This directory contains comprehensive CI/CD scripts for the QuanLyThietBi monorepo.

## Quick Start

### Run Complete CI Pipeline

```bash
./scripts/ci/run-all.sh
```

### Run CI Without Docker

```bash
./scripts/ci/run-all.sh --skip-docker
```

### Run Only Build/Typecheck/Lint (Skip Tests)

```bash
./scripts/ci/run-all.sh --skip-tests
```

### Run Docker Build Without Cache

```bash
./scripts/ci/run-all.sh --no-cache
```

## Scripts Overview

### `run-all.sh`

Main CI pipeline script that runs all tests, builds, and validations.

**Features:**
- ✅ Dependency installation with `pnpm install --frozen-lockfile`
- ✅ Package builds in correct dependency order (domain → contracts → application → infra-postgres)
- ✅ TypeScript type checking for API
- ✅ Svelte type checking for web-ui
- ✅ Test execution for all packages
- ✅ Docker build and smoke tests
- ✅ Comprehensive logging to `artifacts/test-report/*.log`
- ✅ Execution time tracking
- ✅ Fail-fast behavior with clear error reporting

**Options:**
- `--skip-docker`: Skip Docker build and smoke tests
- `--skip-tests`: Only run builds/typecheck/lint, skip test execution
- `--no-cache`: Use `--no-cache` for Docker builds  
- `--help`: Show help message

### `docker-smoke.sh`

Docker smoke testing script for container validation.

**Features:**
- ✅ Start services with `docker compose up -d`
- ✅ Wait for health checks (configurable timeout: 120s)
- ✅ Test multiple potential API endpoints (`/health`, `/health/ready`, etc.)
- ✅ Validate PostgreSQL connectivity
- ✅ Dump logs to `artifacts/test-report/docker.logs` on failure
- ✅ Automatic cleanup with `docker compose down -v`

**Environment Variables:**
- `HEALTHCHECK_TIMEOUT`: Health check timeout in seconds (default: 120)
- `API_PORT`: API service port (default: 3000)

### `verify-snapshots.sh`

Snapshot verification for test stability.

**Features:**
- ✅ Run tests across all packages
- ✅ Detect snapshot file changes
- ✅ Report which snapshots changed  
- ✅ Option to update snapshots automatically

**Options:**
- `--update-snapshots`: Update snapshots if they change
- `--help`: Show help message

## CI Pipeline Execution Order

1. **Environment Check**: Verify Node.js, pnpm, Docker versions
2. **Dependencies**: `pnpm install --frozen-lockfile`
3. **Package Builds** (dependency order):
   - `@qltb/domain` → `@qltb/contracts` → `@qltb/application` → `@qltb/infra-postgres`
4. **Type Checking**: API TypeScript validation
5. **Linting**: ESLint checks (if configured)
6. **Svelte Check**: Web-UI type and component validation  
7. **Tests**: API and Web-UI test suites
8. **Docker Build**: Multi-stage container builds
9. **Smoke Tests**: Health checks and API connectivity

## Logging and Artifacts

All execution logs are saved to `artifacts/test-report/`:
- `install.log` - Dependency installation
- `build-*.log` - Package build logs
- `api-typecheck.log` - API type checking
- `api-test.log` - API test results
- `web-ui-check.log` - Svelte checking
- `web-ui-test.log` - Web-UI test results  
- `docker-build.log` - Docker build output
- `docker-smoke.log` - Smoke test results
- `docker.logs` - Docker container logs (on failure)
- `smoke-test-results.json` - Smoke test summary

## Debugging Failed Builds

When a step fails, the script provides:

1. **Exit immediately** with clear error message
2. **Log file location** for detailed error investigation  
3. **Last 10 lines** of the failed step's output
4. **Execution time** for performance tracking

### Common Debugging Steps

1. Check the specific log file mentioned in the error
2. For Docker issues, inspect `artifacts/test-report/docker.logs`
3. For test failures, review test output in respective `*-test.log` files
4. For build issues, check `build-*.log` files for compilation errors

## Usage in GitHub Actions

```yaml
- name: Run CI Pipeline
  run: ./scripts/ci/run-all.sh

- name: Upload test artifacts  
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: test-reports
    path: artifacts/test-report/
```

## Usage in Local Development

### Quick validation:
```bash
./scripts/ci/run-all.sh --skip-docker --skip-tests
```

### Full development test:
```bash
./scripts/ci/run-all.sh --skip-docker
```

### Production-ready validation:
```bash
./scripts/ci/run-all.sh
```

## Requirements

- **Node.js 20+** 
- **pnpm 8+**
- **Docker & Docker Compose** (for full pipeline)
- **Git** (for snapshot detection)
- **curl & jq** (for smoke tests)

## Exit Codes

- `0` - All steps passed successfully
- `1` - One or more steps failed
- `127` - Required tool not found (pnpm, docker, etc.)

## Troubleshooting

### "pnpm not found"
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### "Docker not available" 
Use `--skip-docker` flag or install Docker

### Type errors in build
Check TypeScript configuration and workspace references in `tsconfig.base.json`

### Test failures
Review specific test logs and ensure test environment is properly configured