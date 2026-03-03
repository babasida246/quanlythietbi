#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

UPDATE_SNAPSHOTS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --update-snapshots)
      UPDATE_SNAPSHOTS=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --update-snapshots  Update snapshots if they change"
      echo "  --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}=== Snapshot Verification ===${NC}"

# Check if any test packages exist
TEST_PACKAGES=(
    "packages/domain"
    "packages/contracts" 
    "packages/application"
    "packages/infra-postgres"
    "apps/api"
    "apps/web-ui"
)

SNAPSHOT_CHANGED=false

for package_dir in "${TEST_PACKAGES[@]}"; do
    if [ ! -d "$package_dir" ]; then
        continue
    fi
    
    if [ ! -f "$package_dir/package.json" ]; then
        continue
    fi
    
    # Check if package has test script
    if ! grep -q '"test"' "$package_dir/package.json"; then
        echo -e "${YELLOW}⚠️  No test script found in $package_dir${NC}"
        continue
    fi
    
    echo -e "${BLUE}Testing $package_dir for snapshots...${NC}"
    
    cd "$package_dir"
    
    # Store git status before running tests
    if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
        git_status_before=$(git status --porcelain || echo "")
    else
        git_status_before=""
    fi
    
    # Run tests
    if [ "$UPDATE_SNAPSHOTS" = true ]; then
        echo "Running tests with snapshot updates enabled..."
        if pnpm test -- --update-snapshots 2>/dev/null || pnpm test -- -u 2>/dev/null || pnpm test; then
            echo -e "${GREEN}✅ Tests passed for $package_dir${NC}"
        else
            echo -e "${RED}❌ Tests failed for $package_dir${NC}"
            cd - >/dev/null
            exit 1
        fi
    else
        echo "Running tests to check for snapshot changes..."
        if pnpm test; then
            echo -e "${GREEN}✅ Tests passed for $package_dir${NC}"
        else
            echo -e "${RED}❌ Tests failed for $package_dir${NC}"
            echo "This might be due to snapshot mismatches. Try running with --update-snapshots"
            cd - >/dev/null
            exit 1
        fi
    fi
    
    # Check if snapshots changed
    if [ -n "$git_status_before" ] && command -v git >/dev/null 2>&1; then
        git_status_after=$(git status --porcelain || echo "")
        
        # Look for snapshot file changes
        if echo "$git_status_after" | grep -q '\.snap\|\.test\.\|spec\.' && [ "$git_status_after" != "$git_status_before" ]; then
            echo -e "${YELLOW}📸 Snapshot files changed in $package_dir!${NC}"
            echo "Changed files:"
            echo "$git_status_after" | grep '\.snap\|\.test\.\|spec\.' || true
            SNAPSHOT_CHANGED=true
        fi
    fi
    
    cd - >/dev/null
done

echo -e "${BLUE}=== Snapshot Verification Summary ===${NC}"

if [ "$SNAPSHOT_CHANGED" = true ]; then
    echo -e "${YELLOW}📸 SNAPSHOTS CHANGED${NC}"
    echo ""
    echo -e "${YELLOW}Action needed:${NC}"
    echo "1. Review the snapshot changes carefully"
    echo "2. If the changes are expected, commit them:"
    echo "   git add ."
    echo "   git commit -m 'update test snapshots'"
    echo "3. If the changes are unexpected, investigate the test failures"
    echo ""
    
    if [ "$UPDATE_SNAPSHOTS" = false ]; then
        echo -e "${YELLOW}💡 Tip: Run with --update-snapshots to automatically update them${NC}"
        exit 1 # Fail CI if snapshots changed but weren't updated
    else
        echo -e "${GREEN}✅ Snapshots were updated as requested${NC}"
    fi
else
    echo -e "${GREEN}✅ No snapshot changes detected${NC}"
fi

exit 0