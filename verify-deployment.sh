#!/bin/bash

# ArchiFlow Deployment Verification Script
# Run this before your presentation to ensure everything works!

set -e

echo "=================================================="
echo "ArchiFlow Deployment Verification"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    SERVICE=$1
    if docker ps --format "{{.Names}}" | grep -q "^${SERVICE}$"; then
        echo -e "${GREEN}✓${NC} ${SERVICE} is running"
        return 0
    else
        echo -e "${RED}✗${NC} ${SERVICE} is NOT running"
        return 1
    fi
}

# Function to check if a port is listening
check_port() {
    PORT=$1
    SERVICE=$2
    if nc -z localhost $PORT 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Port ${PORT} (${SERVICE}) is accessible"
        return 0
    else
        echo -e "${RED}✗${NC} Port ${PORT} (${SERVICE}) is NOT accessible"
        return 1
    fi
}

echo "Step 1: Checking Docker services..."
echo "-----------------------------------"
SERVICES_OK=true
check_service "archiflow-backend" || SERVICES_OK=false
check_service "archiflow-frontend" || SERVICES_OK=false
check_service "archiflow-postgres" || SERVICES_OK=false
echo ""

if [ "$SERVICES_OK" = false ]; then
    echo -e "${RED}Some services are not running!${NC}"
    echo "Run: cd docker && docker-compose up -d"
    exit 1
fi

echo "Step 2: Checking service ports..."
echo "-----------------------------------"
PORTS_OK=true
check_port 3333 "Backend WebSocket" || PORTS_OK=false
check_port 8081 "Frontend" || PORTS_OK=false
check_port 5432 "PostgreSQL" || PORTS_OK=false
echo ""

if [ "$PORTS_OK" = false ]; then
    echo -e "${YELLOW}Warning: Some ports are not accessible${NC}"
fi

echo "Step 3: Checking database tables..."
echo "-----------------------------------"
TABLES=$(docker exec archiflow-postgres psql -U archiflow_user -d archiflow -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'archiflow';")
if [ $TABLES -gt 20 ]; then
    echo -e "${GREEN}✓${NC} Database has $TABLES tables (expected 20+)"
else
    echo -e "${RED}✗${NC} Database has only $TABLES tables (expected 20+)"
    echo "Run database migrations manually"
    exit 1
fi

# Check critical tables
CRITICAL_TABLES=("diagrams" "network_devices" "netbox_devices" "netbox_ip_addresses" "netbox_sites")
for TABLE in "${CRITICAL_TABLES[@]}"; do
    EXISTS=$(docker exec archiflow-postgres psql -U archiflow_user -d archiflow -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'archiflow' AND table_name = '$TABLE');")
    if [[ "$EXISTS" == *"t"* ]]; then
        echo -e "${GREEN}✓${NC} Table archiflow.${TABLE} exists"
    else
        echo -e "${RED}✗${NC} Table archiflow.${TABLE} is MISSING"
        exit 1
    fi
done
echo ""

echo "Step 4: Checking NetBox cache..."
echo "-----------------------------------"
DEVICES_COUNT=$(docker exec archiflow-postgres psql -U archiflow_user -d archiflow -t -c "SELECT COUNT(*) FROM archiflow.netbox_devices;" | tr -d ' ')
SITES_COUNT=$(docker exec archiflow-postgres psql -U archiflow_user -d archiflow -t -c "SELECT COUNT(*) FROM archiflow.netbox_sites;" | tr -d ' ')
PREFIXES_COUNT=$(docker exec archiflow-postgres psql -U archiflow_user -d archiflow -t -c "SELECT COUNT(*) FROM archiflow.netbox_prefixes;" | tr -d ' ')

if [ "$DEVICES_COUNT" -eq 0 ] || [ "$SITES_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠${NC}  NetBox cache is empty (Devices: $DEVICES_COUNT, Sites: $SITES_COUNT, Prefixes: $PREFIXES_COUNT)"
    echo "   Run: curl -X POST http://localhost:3333/api/netbox/sync"
else
    echo -e "${GREEN}✓${NC} NetBox cache populated (Devices: $DEVICES_COUNT, Sites: $SITES_COUNT, Prefixes: $PREFIXES_COUNT)"
fi
echo ""

echo "Step 5: Testing WebSocket connection..."
echo "-----------------------------------"
RESPONSE=$(curl -s http://localhost:3333/health)
if [[ "$RESPONSE" == *"healthy"* ]] || [[ "$RESPONSE" == *"ok"* ]]; then
    echo -e "${GREEN}✓${NC} Backend health check passed"
else
    echo -e "${RED}✗${NC} Backend health check failed"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

echo "Step 6: Testing frontend..."
echo "-----------------------------------"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Frontend is accessible (HTTP 200)"
else
    echo -e "${RED}✗${NC} Frontend returned HTTP $FRONTEND_STATUS"
    exit 1
fi
echo ""

echo "=================================================="
echo -e "${GREEN}All checks passed!${NC}"
echo "=================================================="
echo ""
echo "Your system is ready for the presentation!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:8081 in your browser"
echo "2. Verify you can create a diagram"
echo "3. Test adding a device (should auto-name uniquely)"
echo "4. Check IP pools and VLANs load correctly"
echo "5. Test deployment to NetBox"
echo ""
echo "If NetBox cache was empty, run:"
echo "  curl -X POST http://localhost:3333/api/netbox/sync"
echo ""
