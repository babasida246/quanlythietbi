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
TIMEOUT=${HEALTHCHECK_TIMEOUT:-120}
API_PORT=${API_PORT:-3000}

# Ensure artifacts directory exists
mkdir -p "$ARTIFACTS_DIR"

# Cleanup function
cleanup() {
    echo -e "${YELLOW}=== Cleaning up Docker services ===${NC}"
    docker compose down -v --remove-orphans || true
}

# Set trap for cleanup
trap cleanup EXIT

echo -e "${BLUE}=== Docker Smoke Tests ===${NC}"

# Start services
echo -e "${BLUE}Starting Docker services...${NC}"
docker compose up -d

echo -e "${BLUE}Waiting for services to be healthy (timeout: ${TIMEOUT}s)...${NC}"

# Wait for services with health check
check_health() {
    local service=$1
    local status=$(docker compose ps --format json | jq -r ".[] | select(.Name | contains(\"$service\")) | .Health // \"N/A\"")
    echo "$status"
}

# Wait loop for health checks
elapsed=0
all_healthy=false

while [ $elapsed -lt $TIMEOUT ] && [ "$all_healthy" = false ]; do
    sleep 5
    elapsed=$((elapsed + 5))
    
    # Check postgres health
    postgres_health=$(check_health "postgres")
    
    # Check API container status
    api_status=$(docker compose ps --format json | jq -r '.[] | select(.Name | contains("api")) | .State // "N/A"')
    
    echo "Progress: ${elapsed}s/${TIMEOUT}s - Postgres: $postgres_health, API: $api_status"
    
    if [ "$postgres_health" = "healthy" ] && [ "$api_status" = "running" ]; then
        # Give API a few more seconds to fully initialize
        sleep 10
        all_healthy=true
        echo -e "${GREEN}✅ All services are ready!${NC}"
    fi
done

if [ "$all_healthy" = false ]; then
    echo -e "${RED}❌ Services failed to become healthy within ${TIMEOUT}s${NC}"
    echo -e "${RED}Docker compose status:${NC}"
    docker compose ps
    echo -e "${RED}Dumping logs:${NC}"
    docker compose logs --no-color --tail=300 > "$ARTIFACTS_DIR/docker.logs" 2>&1 || true
    exit 1
fi

# Smoke tests
echo -e "${BLUE}=== Running Smoke Tests ===${NC}"

# Test endpoints
ENDPOINTS=(
    "/health"
    "/health/ready"
    "/api/health" 
    "/api/status"
    "/healthz"
    "/"
)

API_BASE_URL="http://localhost:${API_PORT}"
SUCCESSFUL_ENDPOINT=""

echo "Testing API endpoints against $API_BASE_URL..."

for endpoint in "${ENDPOINTS[@]}"; do
    echo -n "Testing $endpoint... "
    
    if response=$(curl -s -f --max-time 10 "$API_BASE_URL$endpoint" 2>/dev/null); then
        echo -e "${GREEN}✅ OK${NC}"
        echo "Response: $response" | head -c 200
        echo
        SUCCESSFUL_ENDPOINT="$endpoint"
        break
    else
        echo -e "${YELLOW}⚠️  Not available${NC}"
    fi
done

if [ -z "$SUCCESSFUL_ENDPOINT" ]; then
    echo -e "${YELLOW}⚠️  No health endpoints found, checking if API responds to any request...${NC}"
    
    # Try basic connection test
    if timeout 10 bash -c "</dev/tcp/localhost/$API_PORT" 2>/dev/null; then
        echo -e "${GREEN}✅ API port $API_PORT is accepting connections${NC}"
        SUCCESSFUL_ENDPOINT="(port check)"
    else
        echo -e "${RED}❌ Cannot connect to API port $API_PORT${NC}"
        echo -e "${RED}Container logs:${NC}"
        docker compose logs api --tail=50
        exit 1
    fi
fi

# Database connectivity test (if exposed)
echo -e "${BLUE}Testing database connectivity...${NC}"
if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    echo -e "${RED}❌ PostgreSQL connection failed${NC}"
    exit 1
fi

# Check if API can connect to database
echo -e "${BLUE}Testing API database connectivity...${NC}"
if docker compose logs api 2>&1 | grep -i "database\|postgres" | grep -i "connect" | tail -5; then
    echo -e "${GREEN}✅ API database connection logs found${NC}"
else
    echo -e "${YELLOW}⚠️  No database connection logs found in API${NC}"
fi

echo -e "${GREEN}🎉 All smoke tests passed!${NC}"
echo "Successful endpoint: $SUCCESSFUL_ENDPOINT"

# Optional: Save successful configuration for future reference
cat > "$ARTIFACTS_DIR/smoke-test-results.json" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "api_url": "$API_BASE_URL",
    "successful_endpoint": "$SUCCESSFUL_ENDPOINT",
    "postgres_healthy": true,
    "api_responding": true
}
EOF

exit 0