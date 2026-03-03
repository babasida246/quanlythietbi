#!/bin/bash

# Test script for Playwright E2E Testing
# Run comprehensive tests locally or in CI/CD

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_TYPE=${1:-"all"}
HEADLESS=${2:-"true"}

echo -e "${BLUE}🎭 Playwright Test Suite${NC}"
echo "=================================="
echo "Test Type: $TEST_TYPE"
echo "Headless: $HEADLESS"
echo "Project Root: $PROJECT_ROOT"
echo

cd "$PROJECT_ROOT"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to start after $((max_attempts * 2)) seconds${NC}"
    return 1
}

# Function to cleanup processes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    if [ ! -z "$API_PID" ]; then
        kill "$API_PID" 2>/dev/null || true
    fi
    
    if [ ! -z "$WEB_PID" ]; then
        kill "$WEB_PID" 2>/dev/null || true
    fi
    
    # Kill any remaining processes on test ports
    local test_ports=("3001" "4174")
    for port in "${test_ports[@]}"; do
        local pid=$(lsof -ti:$port 2>/dev/null || true)
        if [ ! -z "$pid" ]; then
            kill "$pid" 2>/dev/null || true
            echo -e "${YELLOW}Killed process on port $port${NC}"
        fi
    done
}

# Trap cleanup on script exit
trap cleanup EXIT

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

if ! command_exists pnpm; then
    echo -e "${RED}❌ pnpm is required but not installed${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${YELLOW}⚠ Docker not found - database tests may fail${NC}"
fi

if ! command_exists curl; then
    echo -e "${RED}❌ curl is required for health checks${NC}"
    exit 1
fi

# Setup environment
echo -e "${BLUE}🔧 Setting up test environment...${NC}"

if [ ! -f ".env.test" ]; then
    if [ -f ".env.test.example" ]; then
        cp .env.test.example .env.test
        echo -e "${GREEN}✅ Created .env.test from example${NC}"
    else
        echo -e "${RED}❌ .env.test.example not found${NC}"
        exit 1
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Install Playwright browsers if needed
if [ ! -d "~/.cache/ms-playwright" ] && [ ! -d "/ms-playwright" ]; then
    echo -e "${BLUE}🎭 Installing Playwright browsers...${NC}"
    pnpm exec playwright install
else
    echo -e "${GREEN}✅ Playwright browsers already installed${NC}"
fi

# Build application
echo -e "${BLUE}🏗️ Building application...${NC}"
pnpm run build

# Start services based on test type
if [ "$TEST_TYPE" = "api" ]; then
    echo -e "${BLUE}🚀 Starting API for testing...${NC}"
    pnpm run start:api &
    API_PID=$!
    wait_for_service "http://localhost:3000/health" "API"
    
elif [ "$TEST_TYPE" = "ui" ] || [ "$TEST_TYPE" = "all" ] || [ "$TEST_TYPE" = "smoke" ]; then
    echo -e "${BLUE}🚀 Starting API and Web services...${NC}"
    
    # Start API
    pnpm run start:api &
    API_PID=$!
    
    # Start Web UI
    pnpm run preview &
    WEB_PID=$!
    
    # Wait for services
    wait_for_service "http://localhost:3000/health" "API"
    wait_for_service "http://localhost:4173" "Web UI"
fi

# Run tests based on type
echo -e "${BLUE}🧪 Running tests...${NC}"

case "$TEST_TYPE" in
    "api")
        echo -e "${BLUE}Running API tests only...${NC}"
        if [ "$HEADLESS" = "false" ]; then
            pnpm exec playwright test --project=api --headed
        else
            pnpm exec playwright test --project=api
        fi
        ;;
    "ui")
        echo -e "${BLUE}Running UI tests only...${NC}"
        if [ "$HEADLESS" = "false" ]; then
            pnpm exec playwright test --project=ui-chrome --headed
        else
            pnpm exec playwright test --project=ui-chrome
        fi
        ;;
    "smoke")
        echo -e "${BLUE}Running smoke tests...${NC}"
        pnpm exec playwright test --project=smoke
        ;;
    "all")
        echo -e "${BLUE}Running all tests...${NC}"
        if [ "$HEADLESS" = "false" ]; then
            pnpm exec playwright test --headed
        else
            pnpm exec playwright test
        fi
        ;;
    "debug")
        echo -e "${BLUE}Running tests in debug mode...${NC}"
        pnpm exec playwright test --debug
        ;;
    *)
        echo -e "${RED}❌ Unknown test type: $TEST_TYPE${NC}"
        echo "Valid options: api, ui, smoke, all, debug"
        exit 1
        ;;
esac

TEST_EXIT_CODE=$?

# Show results
echo
echo "=================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo -e "${YELLOW}💡 Run 'pnpm run test:report' to view detailed results${NC}"
fi

echo -e "${BLUE}📊 Test artifacts:${NC}"
echo "- HTML Report: playwright-report/index.html"
echo "- Test Results: test-results/"
echo "- Screenshots: test-results/**/test-failed-*.png"
echo "- Videos: test-results/**/video.webm"

# Exit with test result code
exit $TEST_EXIT_CODE
