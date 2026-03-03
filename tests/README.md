# 🎭 Playwright Test Suite

Comprehensive end-to-end test suite cho hệ thống Quản Lý Thiết Bị sử dụng Playwright.

## 📋 Tổng Quan

Test suite này bao gồm:

- **API Tests**: Kiểm tra tất cả endpoints và API functionality
- **UI E2E Tests**: Kiểm tra giao diện người dùng trên multiple browsers
- **Smoke Tests**: Kiểm tra chức năng cốt lõi nhanh chóng
- **Regression Tests**: Phát hiện các vấn đề trong quá trình phát triển
- **Performance Tests**: Đánh giá hiệu suất hệ thống

## 🚀 Chạy Tests

### Chạy Locally

#### Prerequisites

- Node.js 18+
- pnpm
- Docker (cho database tests)

#### Quick Start

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install

# Setup test environment
cp .env.test.example .env.test

# Build application
pnpm run build

# Run all tests
pnpm run test:e2e
```

#### Các lệnh test cụ thể

```bash
# API tests only
pnpm run test:api

# UI tests only
pnpm run test:ui

# Smoke tests
pnpm run test:smoke

# Run with browser visible (headed mode)
pnpm run test:headed

# Debug mode
pnpm run test:debug

# View test report
pnpm run test:report
```

#### Script helpers

**Windows:**
```bat
# Run all tests
scripts\test\run-tests.bat all

# Run API tests only
scripts\test\run-tests.bat api

# Run with browser visible
scripts\test\run-tests.bat all false
```

**Linux/Mac:**
```bash
# Run all tests
./scripts/test/run-tests.sh all

# Run UI tests only  
./scripts/test/run-tests.sh ui

# Run with browser visible
./scripts/test/run-tests.sh all false
```

### Chạy với Docker

```bash
# Start test services
docker-compose -f docker-compose.test.yml up --build

# Clean up after tests
pnpm run test:docker:clean
```

## 🧪 Test Structure

```
tests/
├── api/                    # API endpoint tests
│   ├── health.spec.ts     # Health check endpoints
│   ├── auth.spec.ts       # Authentication APIs
│   ├── chat.spec.ts       # Chat/messaging APIs
│   ├── tools.spec.ts      # Tools management APIs
│   └── contracts.spec.ts  # Contract management APIs
├── ui/                     # UI end-to-end tests
│   ├── routing.spec.ts    # Navigation and routing
│   ├── layout.spec.ts     # Layout and responsive design
│   ├── auth.spec.ts       # Login/logout flows
│   ├── chat.spec.ts       # Chat interface testing
│   ├── monitoring.spec.ts # System monitoring dashboard
│   └── admin-rbac.spec.ts # Admin and role-based access
├── utils/                  # Test utilities
│   ├── apiClient.ts       # API testing utilities
│   ├── assertions.ts      # Custom assertions
│   └── env.ts            # Environment configuration
├── fixtures/              # Test data and fixtures
│   ├── users.ts          # User test data
│   └── messages.ts       # Message test data
├── global-setup.ts       # Global test setup
└── global-teardown.ts    # Global test cleanup
```

## 🔧 Configuration

### Environment Variables (.env.test)

```bash
# API Configuration
API_BASE_URL=http://localhost:3000
WEB_BASE_URL=http://localhost:4173

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/assets_test

# Authentication
MOCK_AUTH=true
TEST_USER_EMAIL=admin@test.com
TEST_USER_PASSWORD=password

# Test Timeouts
DEFAULT_TIMEOUT=30000
API_TIMEOUT=10000
```

### Playwright Configuration

- **Multiple Projects**: API, Chrome UI, Firefox UI, Mobile UI, Smoke
- **Multiple Browsers**: Chromium, Firefox, WebKit
- **Multiple Viewports**: Desktop, tablet, mobile
- **Parallel Execution**: Tests run in parallel for speed
- **Retry Logic**: Automatic retry on flaky tests
- **Screenshots/Videos**: Captured on failures for debugging

## 📊 Test Reports

### HTML Report

```bash
# Generate and view HTML report
pnpm run test:report
```

Report includes:
- ✅ Test results với pass/fail status
- 📱 Screenshots của failed tests
- 🎥 Videos của test execution
- ⏱️ Performance timing
- 🐛 Error messages và stack traces

### JUnit XML Report

Tự động tạo JUnit XML cho CI/CD integration:
- `test-results/junit-report.xml`

### Test Artifacts

- **Screenshots**: `test-results/**/test-failed-*.png`
- **Videos**: `test-results/**/video.webm`
- **Traces**: `test-results/**/trace.zip`

## 🏗️ CI/CD Integration

### GitHub Actions

Tests tự động chạy trên:
- Push to `main` hoặc `develop` branch
- Pull requests
- Manual workflow dispatch

Matrix strategy tests all browser combinations:
```yaml
strategy:
  matrix:
    project: [api, ui-chrome, ui-firefox, smoke]
```

### Test Jobs

1. **Main Tests**: Full test suite trên multiple projects
2. **Smoke Tests**: Quick validation tests
3. **Security Scan**: Vulnerability scanning
4. **Performance Tests**: Load time validation

## 🐛 Troubleshooting

### Common Issues

#### 1. Tests failing với "Service not ready"

**Giải pháp:**
```bash
# Check services are running
curl http://localhost:3000/health
curl http://localhost:4173

# Restart services
pnpm run start:api
pnpm run preview
```

#### 2. Playwright browsers không install

**Giải pháp:**
```bash
# Force reinstall browsers
pnpm exec playwright install --force

# With dependencies
pnpm exec playwright install --with-deps
```

#### 3. Database connection errors

**Giải pháp:**
```bash
# Start test database
docker-compose up -d postgres

# Run migrations
pnpm run db:migrate

# Seed test data  
./scripts/test/seed-test-data.sh
```

#### 4. Port conflicts

**Giải pháp:**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :4173

# Change ports in .env.test
API_PORT=3001
WEB_PORT=4174
```

### Debug Mode

```bash
# Run specific test in debug mode
pnpm exec playwright test tests/ui/auth.spec.ts --debug

# Run with browser visible
pnpm exec playwright test --headed

# Verbose output
pnpm exec playwright test --reporter=verbose
```

## 📝 Test Writing Guidelines

### API Tests

```typescript
import { ApiClient } from '../utils/apiClient';

test('should return health status', async ({ request }) => {
  const apiClient = new ApiClient(request);
  const response = await apiClient.getHealth();
  
  expect(response.status).toBe('healthy');
  expect(response.database).toBe('connected');
});
```

### UI Tests

```typescript
import { test, expect } from '@playwright/test';

test('should display login form', async ({ page }) => {
  await page.goto('/login');
  
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
});
```

### Best Practices

1. **Descriptive test names**: Sử dụng mô tả rõ ràng về hành vi mong đợi
2. **Page Object Pattern**: Tạo reusable page objects cho UI tests
3. **Data-driven tests**: Sử dụng fixtures cho test data
4. **Proper cleanup**: Ensure tests clean up sau khi chạy
5. **Retry logic**: Handle flaky tests với appropriate retries

## 🎯 Test Coverage

Test suite covers:

### API Endpoints
- ✅ Health checks (`/health`, `/api/health`)
- ✅ Authentication (`/auth/login`, `/auth/logout`)
- ✅ Chat functionality (`/api/chat/completions`)
- ✅ Tools management (`/api/tools`)
- ✅ Contract management (`/api/contracts`)

### UI Features
- ✅ Navigation và routing
- ✅ Responsive layout (desktop/tablet/mobile)
- ✅ Login/logout flows
- ✅ Chat interface
- ✅ System monitoring dashboard
- ✅ Admin panel và RBAC

### Critical Issues Detected
- 🔍 `/login` route 404 error detection
- 🔍 Missing authentication pages
- 🔍 API endpoint availability
- 🔍 UI component loading issues

## 📈 Performance Benchmarks

Tests include performance validation:

- **Page Load Time**: < 2s for optimal, < 5s acceptable
- **API Response Time**: < 500ms for optimal, < 1s acceptable  
- **Chat Message Send**: < 300ms response time
- **Dashboard Load**: < 3s full render

## 🔒 Security Testing

Security checks include:

- **Authentication**: Login flows và session management
- **Authorization**: Role-based access control (RBAC)
- **CSRF Protection**: Form submission security
- **Data Exposure**: Sensitive data trong DOM
- **Session Timeout**: Proper session expiration

## 🤝 Contributing

### Adding New Tests

1. **API Tests**: Thêm vào `tests/api/` với proper naming
2. **UI Tests**: Thêm vào `tests/ui/` với descriptive filenames
3. **Utilities**: Shared code trong `tests/utils/`
4. **Fixtures**: Test data trong `tests/fixtures/`

### Test Requirements

- ✅ Tests phải có descriptive names
- ✅ Error handling và meaningful messages
- ✅ Proper cleanup và resource management
- ✅ Documentation cho complex test logic
- ✅ Performance considerations

## 📞 Support

Nếu gặp vấn đề với test suite:

1. Check [troubleshooting section](#-troubleshooting)
2. Review test artifacts trong `test-results/`
3. Run tests trong debug mode
4. Check GitHub Actions logs cho CI/CD issues

## 🎉 Success Metrics

Test suite quan trọng để:

- 🚫 **Prevent regressions**: Phát hiện breaking changes
- ⚡ **Ensure performance**: Validate load times
- 🔒 **Verify security**: Test authentication và authorization
- 🐛 **Catch bugs early**: Detect issues before production
- 📊 **Monitor health**: Continuous system validation