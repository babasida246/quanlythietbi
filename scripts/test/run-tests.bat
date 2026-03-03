@echo off
REM Playwright Test Suite for Windows
REM Run comprehensive tests locally

setlocal enabledelayedexpansion

REM Configuration
set TEST_TYPE=%1
if "%TEST_TYPE%"=="" set TEST_TYPE=all

set HEADLESS=%2
if "%HEADLESS%"=="" set HEADLESS=true

set PROJECT_ROOT=%~dp0..\..
cd /d "%PROJECT_ROOT%"

echo 🎭 Playwright Test Suite
echo ==================================
echo Test Type: %TEST_TYPE%
echo Headless: %HEADLESS%
echo Project Root: %CD%
echo.

REM Check dependencies
echo 🔍 Checking dependencies...

pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pnpm is required but not installed
    exit /b 1
)

docker --version >nul 2>&1
if errorlevel 1 (
    echo ⚠ Docker not found - database tests may fail
)

curl --version >nul 2>&1
if errorlevel 1 (
    echo ❌ curl is required for health checks
    exit /b 1
)

REM Setup environment
echo 🔧 Setting up test environment...

if not exist ".env.test" (
    if exist ".env.test.example" (
        copy ".env.test.example" ".env.test" >nul
        echo ✅ Created .env.test from example
    ) else (
        echo ❌ .env.test.example not found
        exit /b 1
    )
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
) else (
    echo ✅ Dependencies already installed
)

REM Install Playwright browsers if needed
echo 🎭 Installing Playwright browsers...
pnpm exec playwright install --with-deps

REM Build application
echo 🏗️ Building application...
pnpm run build
if errorlevel 1 (
    echo ❌ Build failed
    exit /b 1
)

REM Start services based on test type
if /i "%TEST_TYPE%"=="api" (
    echo 🚀 Starting API for testing...
    start /b pnpm run start:api
    timeout /t 10 /nobreak >nul
    curl -f http://localhost:3000/health >nul 2>&1
    if errorlevel 1 (
        echo ❌ API failed to start
        exit /b 1
    )
    echo ✅ API is ready
) else (
    echo 🚀 Starting API and Web services...
    
    REM Start API
    start /b pnpm run start:api
    
    REM Start Web UI  
    start /b pnpm run preview
    
    REM Wait for services
    timeout /t 15 /nobreak >nul
    
    curl -f http://localhost:3000/health >nul 2>&1
    if errorlevel 1 (
        echo ❌ API failed to start
        exit /b 1
    )
    echo ✅ API is ready
    
    curl -f http://localhost:4173 >nul 2>&1
    if errorlevel 1 (
        echo ❌ Web UI failed to start
        exit /b 1
    )
    echo ✅ Web UI is ready
)

REM Run tests based on type
echo 🧪 Running tests...

if /i "%TEST_TYPE%"=="api" (
    echo Running API tests only...
    if /i "%HEADLESS%"=="false" (
        pnpm exec playwright test --project=api --headed
    ) else (
        pnpm exec playwright test --project=api
    )
) else if /i "%TEST_TYPE%"=="ui" (
    echo Running UI tests only...
    if /i "%HEADLESS%"=="false" (
        pnpm exec playwright test --project=ui-chrome --headed
    ) else (
        pnpm exec playwright test --project=ui-chrome
    )
) else if /i "%TEST_TYPE%"=="smoke" (
    echo Running smoke tests...
    pnpm exec playwright test --project=smoke
) else if /i "%TEST_TYPE%"=="all" (
    echo Running all tests...
    if /i "%HEADLESS%"=="false" (
        pnpm exec playwright test --headed
    ) else (
        pnpm exec playwright test
    )
) else if /i "%TEST_TYPE%"=="debug" (
    echo Running tests in debug mode...
    pnpm exec playwright test --debug
) else (
    echo ❌ Unknown test type: %TEST_TYPE%
    echo Valid options: api, ui, smoke, all, debug
    exit /b 1
)

set TEST_EXIT_CODE=%errorlevel%

REM Show results
echo.
echo ==================================
if %TEST_EXIT_CODE%==0 (
    echo ✅ All tests passed!
) else (
    echo ❌ Some tests failed
    echo 💡 Run 'pnpm run test:report' to view detailed results
)

echo 📊 Test artifacts:
echo - HTML Report: playwright-report/index.html
echo - Test Results: test-results/
echo - Screenshots: test-results/**/*test-failed-*.png
echo - Videos: test-results/**/video.webm

REM Cleanup
echo 🧹 Cleaning up...
taskkill /f /im node.exe >nul 2>&1

REM Exit with test result code
exit /b %TEST_EXIT_CODE%
