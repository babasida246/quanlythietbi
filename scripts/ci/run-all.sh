#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ARTIFACTS_DIR="artifacts/test-report"
SKIP_DOCKER=false
SKIP_TESTS=false
NO_CACHE=false
CHANGED_ONLY=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-docker)
      SKIP_DOCKER=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    --changed-only)
      CHANGED_ONLY=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --skip-docker    Skip Docker build and smoke tests"
      echo "  --skip-tests     Only run builds/typecheck/lint, skip tests"
      echo "  --no-cache      Use --no-cache for Docker builds"
      echo "  --changed-only  Only run tests for changed packages (not implemented)"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Create artifacts directory
mkdir -p "$ARTIFACTS_DIR"

# Summary tracking
declare -a STEP_RESULTS=()
START_TIME=$(date +%s)

# Helper function to run steps
run_step() {
    local step_name="$1"
    local command="$2"
    local log_file="$ARTIFACTS_DIR/${step_name}.log"
    
    echo -e "${BLUE}=== Running: $step_name ===${NC}"
    echo "Command: $command"
    echo "Log file: $log_file"
    echo
    
    local step_start=$(date +%s)
    
    if eval "$command" 2>&1 | tee "$log_file"; then
        local step_end=$(date +%s)
        local duration=$((step_end - step_start))
        echo -e "${GREEN}✅ $step_name - PASSED (${duration}s)${NC}"
        STEP_RESULTS+=("PASS $step_name (${duration}s)")
    else
        local step_end=$(date +%s) 
        local duration=$((step_end - step_start))
        echo -e "${RED}❌ $step_name - FAILED (${duration}s)${NC}"
        echo -e "${RED}Debug info:${NC}"
        echo "  - Check log file: $log_file"
        echo "  - Last 10 lines:"
        tail -10 "$log_file" || true
        STEP_RESULTS+=("FAIL $step_name (${duration}s)")
        exit 1
    fi
    echo
}

# Print environment info
print_env_info() {
    echo -e "${BLUE}=== Environment Information ===${NC}"
    echo "Node version: $(node --version || echo 'Not found')"
    echo "pnpm version: $(pnpm --version || echo 'Not found')"
    echo "Docker version: $(docker --version || echo 'Not found')"
    echo "Docker Compose version: $(docker compose version || echo 'Not found')"
    echo "Working directory: $(pwd)"
    echo "Timestamp: $(date)"
    echo
}

# Cleanup function
cleanup() {
    if [ "$SKIP_DOCKER" = false ]; then
        echo -e "${YELLOW}=== Cleanup Docker services ===${NC}"
        docker compose down -v --remove-orphans || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
echo -e "${BLUE}=== QuanLyThietBi CI Pipeline ===${NC}"
echo "Configuration:"
echo "  Skip Docker: $SKIP_DOCKER"
echo "  Skip Tests: $SKIP_TESTS"
echo "  No Cache: $NO_CACHE"
echo "  Changed Only: $CHANGED_ONLY"
echo

print_env_info

# Step 1: Install dependencies
run_step "install" "pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile"

# Step 2: Build packages in dependency order
run_step "build-domain" "pnpm --filter=@qltb/domain build"
run_step "build-contracts" "pnpm --filter=@qltb/contracts build"  
run_step "build-application" "pnpm --filter=@qltb/application build"
run_step "build-infra-postgres" "pnpm --filter=@qltb/infra-postgres build"

# Step 3: API typecheck and lint
run_step "api-typecheck" "pnpm --filter=@qltb/api typecheck"

# Add lint if it exists
if pnpm --filter=@qltb/api run | grep -q "lint"; then
    run_step "api-lint" "pnpm --filter=@qltb/api lint"
fi

# Step 4: Web UI check
run_step "web-ui-check" "pnpm --filter=@qltb/web-ui check"

# Step 5: Run tests (if not skipped)
if [ "$SKIP_TESTS" = false ]; then
    run_step "unit-tests" "pnpm test:unit"
fi

# Step 6: Docker build and smoke tests (if not skipped)
if [ "$SKIP_DOCKER" = false ]; then
    DOCKER_BUILD_CMD="docker compose build"
    if [ "$NO_CACHE" = true ]; then
        DOCKER_BUILD_CMD="$DOCKER_BUILD_CMD --no-cache"
    fi
    
    run_step "docker-build" "$DOCKER_BUILD_CMD"
    run_step "docker-smoke" "./scripts/ci/docker-smoke.sh"
fi

# Summary
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo -e "${BLUE}=== CI Pipeline Summary ===${NC}"
echo "Total duration: ${TOTAL_DURATION}s"
echo
echo "Step Results:"
for result in "${STEP_RESULTS[@]}"; do
    if [[ $result == PASS* ]]; then
        echo -e "  ${GREEN}$result${NC}"
    else
        echo -e "  ${RED}$result${NC}"
    fi
done

# Check if all passed
FAILED_COUNT=$(printf '%s\n' "${STEP_RESULTS[@]}" | grep -c "^FAIL" || true)
if [ "$FAILED_COUNT" -eq 0 ]; then
    echo -e "${GREEN}🎉 All steps PASSED!${NC}"
    exit 0
else
    echo -e "${RED}💥 $FAILED_COUNT step(s) FAILED${NC}"
    exit 1
fi
