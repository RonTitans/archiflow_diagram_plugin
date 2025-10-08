# ArchiFlow Deployment Guide

## Quick Start (New Machine)

### Prerequisites
- Docker Desktop installed and running
- Git installed

### Steps

1. **Clone the repository**:
```bash
git clone https://github.com/RonTitans/archiflow_diagram_plugin.git
cd archiflow_diagram_plugin
```

2. **Start the system**:
```bash
cd docker
docker-compose up -d
```

3. **Wait for initialization** (about 30 seconds):
```bash
# Check if all services are healthy
docker ps
```

4. **Access the application**:
- **Main App**: http://localhost:8081
- **Database Admin**: http://localhost:8082 (Adminer)
  - Server: `archiflow-postgres`
  - Username: `archiflow_user`
  - Password: `archiflow_pass`
  - Database: `archiflow`

## What Gets Automatically Created

When you run `docker-compose up -d` for the first time, the system automatically:

### Database Tables (13 total)
- ✅ `diagrams` - Network diagrams with Draw.io XML
- ✅ `diagram_versions` - Version history
- ✅ `sites` - Site management with auto-naming codes
- ✅ `network_devices` - Device inventory
- ✅ `device_templates` - 11 pre-configured templates
- ✅ `device_diagram_mapping` - Links devices to diagram cells
- ✅ `device_counters` - Auto-naming counters
- ✅ `ip_pools` - 5 network pools
- ✅ `ip_addresses` - 1,270+ pre-populated IPs
- ✅ `ip_allocations` - IP-to-device assignments
- ✅ `vlans` - 7 VLANs configured
- ✅ `port_connections` - Device connections
- ✅ `schema_migrations` - Version tracking

### Device Templates
1. Cisco Router (ISR4000)
2. Cisco Catalyst Switch (48-port)
3. **Cisco C9200-24P** (with SVG image)
4. Fortinet Firewall
5. Dell Server
6. F5 Load Balancer
7. Cisco Access Point
8. Workstation
9. Cloud Service (AWS)
10. Internet Gateway
11. PostgreSQL Database

### IP Pools
1. Management Network - `192.168.1.0/24` (VLAN 10)
2. Production Servers - `10.10.20.0/24` (VLAN 20)
3. Development Network - `10.10.30.0/24` (VLAN 30)
4. DMZ Network - `172.16.40.0/24` (VLAN 40)
5. Guest Network - `192.168.50.0/24` (VLAN 50)

### Sites
1. Main Data Center (code: MAIN)
2. Backup Site (code: BACKUP)
3. Cloud Region US-East (code: CLOUD)

## Clean Reinstall

If you need to start fresh:

```bash
cd docker
docker-compose down -v  # Removes containers AND data volumes
docker-compose up -d    # Fresh start with clean database
```

## Verifying Installation

### Check All Tables Created
```bash
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "\dt archiflow.*"
```

Expected output: 13 tables

### Check Device Templates
```bash
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT COUNT(*) FROM archiflow.device_templates;"
```

Expected output: 11 templates

### Check IP Addresses
```bash
docker exec archiflow-postgres psql -U archiflow_user -d archiflow -c "SELECT COUNT(*) FROM archiflow.ip_addresses;"
```

Expected output: ~1270 IP addresses

### Check Services Status
```bash
docker ps --filter "name=archiflow"
```

All 5 containers should show "Up" status:
- archiflow-postgres (healthy)
- archiflow-backend (healthy)
- archiflow-frontend
- archiflow-adminer
- archiflow-drawio

### View Logs
```bash
# Backend logs
docker logs -f archiflow-backend

# Database logs
docker logs -f archiflow-postgres

# Frontend logs
docker logs -f archiflow-frontend
```

## Troubleshooting

### Issue: "Loading templates..." stuck

**Solution**: Backend needs to restart after database initialization
```bash
docker restart archiflow-backend
```

### Issue: Database tables missing

**Check if init script ran:**
```bash
docker logs archiflow-postgres | grep "CREATE TABLE"
```

If no output, the init script didn't run. This means:
1. Database volume already existed from previous run
2. PostgreSQL only runs init scripts on empty database

**Solution:**
```bash
cd docker
docker-compose down -v  # IMPORTANT: -v removes volumes
docker-compose up -d
```

### Issue: Can't connect to services

**Check Docker Desktop is running:**
```bash
docker ps
```

**Check ports aren't in use:**
```bash
# Windows
netstat -ano | findstr "8081"
netstat -ano | findstr "3333"
netstat -ano | findstr "5432"
```

### Issue: Git credential errors

This is harmless. The push succeeded despite the warning.

## Port Usage

- **8081**: Frontend web server
- **3333**: WebSocket backend
- **5432**: PostgreSQL database
- **8082**: Adminer (database UI)
- **8083**: Draw.io server

Make sure these ports are available on your machine.

## Environment Variables

Located in `docker-compose.yml`:

```yaml
# Database
POSTGRES_DB: archiflow
POSTGRES_USER: archiflow_user
POSTGRES_PASSWORD: archiflow_pass

# Backend
DB_MODE: postgresql  # CRITICAL: Never change to 'mock'
DB_HOST: archiflow-postgres
DB_PORT: 5432
WS_PORT: 3333
```

## File Structure

```
archiflow_diagram_plugin/
├── database/
│   ├── init-complete.sql          # ⭐ Complete schema (auto-loaded)
│   ├── schema.sql                 # Legacy base schema
│   ├── network-schema.sql         # Legacy network tables
│   └── migrations/                # Additional migrations
├── docker/
│   ├── docker-compose.yml         # ⭐ Main deployment file
│   └── Dockerfile.backend         # Backend container build
├── backend/
│   ├── websocket-server.js        # WebSocket server
│   ├── network-device-manager.js  # Device management logic
│   └── database.js                # PostgreSQL client
├── frontend/
│   ├── index.html                 # Main UI
│   ├── app.js                     # PostMessage handler
│   ├── archiflow-network-plugin.js # Device plugin
│   └── images/devices/            # Device SVG images
└── README.md                      # Main documentation
```

## Next Steps After Installation

1. Open http://localhost:8081
2. Select a site from the dropdown
3. Click "New Diagram"
4. Click "Add Device" to see the 11 device templates
5. Select "Cisco C9200-24P" to add a switch with real SVG image
6. Device will auto-name (e.g., "MAIN-SW-001")
7. Device gets auto-allocated IP from pool
8. Save diagram - all data persists to PostgreSQL

## Architecture

```
┌─────────────────────────────────────────┐
│   Browser (localhost:8081)              │
│   - Draw.io iframe (embed.diagrams.net) │
│   - Device selection UI                 │
│   - PostMessage protocol                │
└──────────────┬──────────────────────────┘
               │ WebSocket (ws://localhost:3333)
┌──────────────┴──────────────────────────┐
│   Backend (Node.js)                     │
│   - WebSocket server                    │
│   - Network device manager              │
│   - IP allocation logic                 │
└──────────────┬──────────────────────────┘
               │ PostgreSQL protocol
┌──────────────┴──────────────────────────┐
│   PostgreSQL Database                   │
│   - 13 tables                           │
│   - Automatic schema initialization     │
│   - Version control                     │
└─────────────────────────────────────────┘
```

## Updating the System

When you pull new changes from GitHub:

```bash
# Pull latest code
git pull origin main

# Restart services (keeps data)
cd docker
docker-compose down
docker-compose up -d

# If you need to rebuild backend after code changes
docker-compose down
docker-compose build archiflow-backend
docker-compose up -d
```

## Database Migrations

The system tracks schema versions in `schema_migrations` table.

To apply new migrations manually:
```bash
docker exec -i archiflow-postgres psql -U archiflow_user -d archiflow < database/migrations/003_new_migration.sql
```

## Backup & Restore

### Backup
```bash
docker exec archiflow-postgres pg_dump -U archiflow_user archiflow > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i archiflow-postgres psql -U archiflow_user -d archiflow
```

## Production Considerations

For production deployment:

1. Change default passwords in `docker-compose.yml`
2. Use environment file (`.env`) instead of hardcoded values
3. Set up SSL/TLS for WebSocket connections
4. Configure PostgreSQL for performance (connections, memory)
5. Set up regular database backups
6. Use `NODE_ENV=production`
7. Consider using Docker Swarm or Kubernetes for orchestration

## Support

- GitHub Issues: https://github.com/RonTitans/archiflow_diagram_plugin/issues
- Documentation: See README.md and CLAUDE.md
